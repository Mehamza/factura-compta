-- Enforce stock and margin constraints server-side.
-- - Prevent sales invoices from exceeding available stock.
-- - Prevent discounted selling price (HT) from going below purchase price.
--
-- Notes:
-- - Applies to sales documents only (document_kind NOT ending with "_achat").
-- - Skips pre-sales docs (devis, bon_commande) and sales credit notes (facture_avoir).
-- - Uses DEFERRABLE constraint triggers so multi-row inserts/updates are validated at commit.

begin;

-- 1) Compute global discount ratio used by UI (proportional discount distribution)
create or replace function public._invoice_discount_ratio(p_invoice_id uuid)
returns numeric
language plpgsql
stable
as $$
declare
  v_subtotal numeric;
  v_type text;
  v_value numeric;
  v_ratio numeric := 1;
begin
  select coalesce(sum(coalesce(ii.total, 0)), 0)
    into v_subtotal
  from public.invoice_items ii
  where ii.invoice_id = p_invoice_id;

  select i.discount_type, coalesce(i.discount_value, 0)
    into v_type, v_value
  from public.invoices i
  where i.id = p_invoice_id;

  if v_subtotal <= 0 or v_value <= 0 then
    return 1;
  end if;

  if v_type = 'percent' then
    v_ratio := 1 - (v_value / 100);
  else
    v_ratio := (v_subtotal - v_value) / v_subtotal;
  end if;

  if v_ratio < 0 then
    v_ratio := 0;
  end if;

  if v_ratio > 1 then
    v_ratio := 1;
  end if;

  return v_ratio;
end;
$$;

-- 2) Main enforcement routine
create or replace function public.enforce_sales_invoice_constraints(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_kind text;
  v_ratio numeric;
  v_violation record;
begin
  select i.company_id, i.document_kind
    into v_company_id, v_kind
  from public.invoices i
  where i.id = p_invoice_id;

  if v_kind is null then
    return;
  end if;

  -- Only sales docs (exclude purchases)
  if v_kind like '%\\_achat' escape '\\' then
    return;
  end if;

  -- Skip docs where stock/margin constraints should not block workflow
  if v_kind in ('devis', 'bon_commande', 'facture_avoir') then
    return;
  end if;

  -- Ensure invoice cannot reference products from another company
  select ii.product_id
    into v_violation
  from public.invoice_items ii
  left join public.products p
    on p.id = ii.product_id
   and p.company_id = v_company_id
  where ii.invoice_id = p_invoice_id
    and ii.product_id is not null
    and p.id is null
  limit 1;

  if found then
    raise exception using
      message = 'Produit invalide: le produit ne correspond pas à la société de la facture.',
      errcode = 'P0001';
  end if;

  -- Lock all involved product rows to reduce race conditions
  perform 1
  from public.products p
  join (
    select distinct ii.product_id
    from public.invoice_items ii
    where ii.invoice_id = p_invoice_id
      and ii.product_id is not null
  ) x
    on x.product_id = p.id
  where p.company_id = v_company_id
  for update;

  -- Stock constraint: total quantity per product in the invoice must not exceed products.quantity
  select n.product_id, n.qty_needed, p.quantity as qty_available
    into v_violation
  from (
    select ii.product_id, coalesce(sum(coalesce(ii.quantity, 0)), 0) as qty_needed
    from public.invoice_items ii
    where ii.invoice_id = p_invoice_id
      and ii.product_id is not null
    group by ii.product_id
  ) n
  join public.products p
    on p.id = n.product_id
   and p.company_id = v_company_id
  where n.qty_needed > coalesce(p.quantity, 0)
  limit 1;

  if found then
    raise exception using
      message = format(
        'Stock insuffisant: produit %s, demandé %s, disponible %s',
        v_violation.product_id,
        v_violation.qty_needed,
        v_violation.qty_available
      ),
      errcode = 'P0001';
  end if;

  -- Margin constraint: discounted unit_price (HT) must not go below purchase_price
  v_ratio := public._invoice_discount_ratio(p_invoice_id);

  select ii.product_id,
         coalesce(p.purchase_price, 0) as purchase_price,
         (coalesce(ii.unit_price, 0) * v_ratio) as discounted_unit_price
    into v_violation
  from public.invoice_items ii
  join public.products p
    on p.id = ii.product_id
   and p.company_id = v_company_id
  where ii.invoice_id = p_invoice_id
    and ii.product_id is not null
    and coalesce(ii.quantity, 0) > 0
    and coalesce(p.purchase_price, 0) > (coalesce(ii.unit_price, 0) * v_ratio)
  limit 1;

  if found then
    raise exception using
      message = format(
        'Prix remisé inférieur au prix d''achat: produit %s, prix remisé %s, prix achat %s',
        v_violation.product_id,
        v_violation.discounted_unit_price,
        v_violation.purchase_price
      ),
      errcode = 'P0001';
  end if;
end;
$$;

-- 3) Triggers to invoke enforcement
create or replace function public._trg_validate_invoice_items_sales_constraints()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_sales_invoice_constraints(coalesce(new.invoice_id, old.invoice_id));
  return null;
end;
$$;

create or replace function public._trg_validate_invoice_sales_constraints()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_sales_invoice_constraints(new.id);
  return null;
end;
$$;

drop trigger if exists trg_invoice_items_sales_constraints on public.invoice_items;
create constraint trigger trg_invoice_items_sales_constraints
after insert or update or delete
on public.invoice_items
deferrable initially deferred
for each row
execute function public._trg_validate_invoice_items_sales_constraints();

drop trigger if exists trg_invoices_sales_constraints on public.invoices;
create constraint trigger trg_invoices_sales_constraints
after insert or update of discount_type, discount_value, document_kind
on public.invoices
deferrable initially deferred
for each row
execute function public._trg_validate_invoice_sales_constraints();

commit;
