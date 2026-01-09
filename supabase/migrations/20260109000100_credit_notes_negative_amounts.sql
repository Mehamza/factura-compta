-- Credit notes (avoirs): linkage, negativity, stamp handling, and stronger totals recompute

-- 1) Link credit notes to a source invoice
alter table if exists public.invoices
  add column if not exists source_invoice_id uuid references public.invoices(id) on delete restrict;

create index if not exists idx_invoices_source_invoice_id on public.invoices(source_invoice_id);

-- Ensure credit note source is within the same company
create or replace function public.enforce_credit_note_source_company()
returns trigger language plpgsql as $$
declare
  v_company uuid;
begin
  if new.source_invoice_id is null then
    return new;
  end if;

  select company_id into v_company from public.invoices where id = new.source_invoice_id;
  if v_company is null then
    raise exception 'Source invoice not found';
  end if;
  if v_company <> new.company_id then
    raise exception 'Source invoice must belong to same company';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_credit_note_source_company on public.invoices;
create trigger trg_enforce_credit_note_source_company
before insert or update of source_invoice_id, company_id on public.invoices
for each row execute function public.enforce_credit_note_source_company();

-- 2) Credit notes must have stamp disabled/zero
create or replace function public.enforce_credit_note_stamp()
returns trigger language plpgsql as $$
begin
  if new.document_kind in ('facture_avoir', 'avoir_achat') then
    new.stamp_included := false;
    new.stamp_amount := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_credit_note_stamp on public.invoices;
create trigger trg_enforce_credit_note_stamp
before insert or update of document_kind, stamp_included, stamp_amount on public.invoices
for each row execute function public.enforce_credit_note_stamp();

-- 3) Prevent deleting validated documents and prevent editing validated credit notes
create or replace function public.prevent_delete_validated_invoice()
returns trigger language plpgsql as $$
begin
  if old.status = 'validated' then
    raise exception 'Cannot delete a validated document';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_prevent_delete_validated_invoice on public.invoices;
create trigger trg_prevent_delete_validated_invoice
before delete on public.invoices
for each row execute function public.prevent_delete_validated_invoice();

create or replace function public.prevent_update_validated_credit_note()
returns trigger language plpgsql as $$
begin
  if old.document_kind in ('facture_avoir', 'avoir_achat') and old.status = 'validated' then
    -- allow status to remain validated but block other updates
    if (new.status is distinct from old.status) then
      raise exception 'Cannot change status of a validated credit note';
    end if;
    if (row(new.*) is distinct from row(old.*)) then
      raise exception 'Cannot update a validated credit note';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_update_validated_credit_note on public.invoices;
create trigger trg_prevent_update_validated_credit_note
before update on public.invoices
for each row execute function public.prevent_update_validated_credit_note();

-- 4) Improve totals recompute to match per-line VAT/FODEC model (supports negative values)
create or replace function public.recompute_invoice_totals(p_invoice_id uuid)
returns void as $$
declare
  v_subtotal numeric := 0;
  v_tax_amount numeric := 0;
  v_fodec_amount numeric := 0;
  v_stamp_included boolean := false;
  v_stamp_amount numeric := 0;
  v_kind text;
begin
  select coalesce(sum(total),0), coalesce(sum(vat_amount),0), coalesce(sum(fodec_amount),0)
    into v_subtotal, v_tax_amount, v_fodec_amount
  from public.invoice_items where invoice_id = p_invoice_id;

  select stamp_included, stamp_amount, document_kind
    into v_stamp_included, v_stamp_amount, v_kind
  from public.invoices where id = p_invoice_id;

  -- Safety: credit notes never carry stamp
  if v_kind in ('facture_avoir', 'avoir_achat') then
    v_stamp_included := false;
    v_stamp_amount := 0;
  end if;

  update public.invoices
    set subtotal = v_subtotal,
        tax_amount = v_tax_amount,
        fodec_amount = v_fodec_amount,
        total = v_subtotal + v_tax_amount + case when v_stamp_included then coalesce(v_stamp_amount,0) else 0 end
    where id = p_invoice_id;
end; $$ language plpgsql security definer;

-- 5) Ensure invoice_items totals are coherent with quantity/unit_price (supports negative)
create or replace function public.trg_invoice_items_compute_amounts()
returns trigger language plpgsql as $$
declare
  v_ht numeric;
  v_fodec numeric;
  v_vat numeric;
  v_qty numeric;
  v_unit numeric;
  v_vat_rate numeric;
  v_fodec_rate numeric;
begin
  v_qty := coalesce(new.quantity, 0);
  v_unit := coalesce(new.unit_price, 0);
  v_ht := v_qty * v_unit;

  v_fodec_rate := coalesce(new.fodec_rate, 0);
  if coalesce(new.fodec_applicable, false) then
    v_fodec := v_ht * v_fodec_rate;
  else
    v_fodec := 0;
  end if;

  v_vat_rate := coalesce(new.vat_rate, 0);
  v_vat := (v_ht + v_fodec) * (v_vat_rate / 100.0);

  new.total := v_ht;
  new.fodec_amount := v_fodec;
  new.vat_amount := v_vat;
  return new;
end;
$$;

drop trigger if exists trg_invoice_items_compute_amounts on public.invoice_items;
create trigger trg_invoice_items_compute_amounts
before insert or update of quantity, unit_price, vat_rate, fodec_applicable, fodec_rate on public.invoice_items
for each row execute function public.trg_invoice_items_compute_amounts();
