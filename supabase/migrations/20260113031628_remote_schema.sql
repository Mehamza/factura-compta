drop trigger if exists "trg_invoice_items_sales_constraints" on "public"."invoice_items";

drop trigger if exists "trg_invoices_recompute_payment_status" on "public"."invoices";

drop trigger if exists "trg_invoices_sales_constraints" on "public"."invoices";

drop trigger if exists "trg_invoices_recompute_on_change" on "public"."invoices";

do $$
begin
  if to_regclass('public.product_pricing_history') is not null then
    execute 'drop policy if exists "product_pricing_history_insert_privileged" on "public"."product_pricing_history"';
  end if;
end $$;

do $$
begin
  if to_regclass('public.stock_document_items') is not null then
    execute 'drop policy if exists "stock_document_items_insert_privileged" on "public"."stock_document_items"';
  end if;
end $$;

do $$
begin
  if to_regclass('public.stock_documents') is not null then
    execute 'drop policy if exists "stock_documents_insert_privileged" on "public"."stock_documents"';
  end if;
end $$;

alter table "public"."invoices" drop constraint if exists "invoices_payment_status_check";

drop function if exists "public"."_invoice_discount_ratio"(p_invoice_id uuid);

drop function if exists "public"."_trg_validate_invoice_items_sales_constraints"();

drop function if exists "public"."_trg_validate_invoice_sales_constraints"();

drop function if exists "public"."enforce_sales_invoice_constraints"(p_invoice_id uuid);

drop function if exists "public"."recompute_invoice_payment_status"(p_invoice_id uuid);

drop function if exists "public"."trg_invoices_recompute_payment_status"();

alter table "public"."invoices" drop column if exists "payment_status";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.refresh_invoice_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.invoices i
  SET status = CASE
    WHEN public.invoice_outstanding(i.id) <= 0 THEN 'paid'
    WHEN i.due_date < now()::date THEN 'overdue'
    ELSE i.status
  END
  WHERE i.id = COALESCE(new.invoice_id, old.invoice_id);
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recompute_invoice_totals(p_invoice_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_subtotal numeric := 0;
  v_tax_amount numeric := 0;
  v_fodec_amount numeric := 0;
  v_stamp_included boolean := false;
  v_stamp_amount numeric := 0;
BEGIN
  -- Sum HT totals from items
  SELECT COALESCE(SUM(total), 0) INTO v_subtotal 
  FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  
  -- Sum VAT amounts from items (per-item VAT)
  SELECT COALESCE(SUM(vat_amount), 0) INTO v_tax_amount 
  FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  
  -- Sum FODEC amounts from items
  SELECT COALESCE(SUM(fodec_amount), 0) INTO v_fodec_amount 
  FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  
  -- Get stamp info
  SELECT stamp_included, stamp_amount INTO v_stamp_included, v_stamp_amount 
  FROM public.invoices WHERE id = p_invoice_id;
  
  -- Update invoice with calculated totals
  UPDATE public.invoices
  SET subtotal = v_subtotal,
      tax_amount = v_tax_amount,
      fodec_amount = v_fodec_amount,
      total = v_subtotal + v_fodec_amount + v_tax_amount + CASE WHEN v_stamp_included THEN COALESCE(v_stamp_amount, 0) ELSE 0 END
  WHERE id = p_invoice_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_invoices_recompute_on_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.recompute_invoice_totals(new.id);
  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_payment_update_invoice_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.invoice_id IS NOT NULL THEN
    PERFORM public.update_invoice_payment_status(OLD.invoice_id);
  ELSIF NEW.invoice_id IS NOT NULL THEN
    PERFORM public.update_invoice_payment_status(NEW.invoice_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$
;


do $$
begin
  if to_regclass('public.product_pricing_history') is not null then
    execute $policy$
      create policy "product_pricing_history_insert_privileged"
      on "public"."product_pricing_history"
      as permissive
      for insert
      to public
      with check ((EXISTS (
        select 1
        from public.company_users cu
        where (
          cu.company_id = product_pricing_history.company_id
          and cu.user_id = auth.uid()
          and cu.role = any (array[
            'caissier'::public.company_role,
            'company_admin'::public.company_role,
            'gerant'::public.company_role,
            'comptable'::public.company_role
          ])
        )
      )));
    $policy$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.stock_document_items') is not null then
    execute $policy$
      create policy "stock_document_items_insert_privileged"
      on "public"."stock_document_items"
      as permissive
      for insert
      to public
      with check ((exists (
        select 1
        from (
          public.stock_documents d
          join public.company_users cu on (
            cu.company_id = d.company_id
            and cu.user_id = auth.uid()
            and cu.role = any (array[
              'caissier'::public.company_role,
              'company_admin'::public.company_role,
              'gerant'::public.company_role,
              'comptable'::public.company_role
            ])
          )
        )
        where d.id = stock_document_items.document_id
      )));
    $policy$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.stock_documents') is not null then
    execute $policy$
      create policy "stock_documents_insert_privileged"
      on "public"."stock_documents"
      as permissive
      for insert
      to public
      with check ((exists (
        select 1
        from public.company_users cu
        where (
          cu.company_id = stock_documents.company_id
          and cu.user_id = auth.uid()
          and cu.role = any (array[
            'caissier'::public.company_role,
            'company_admin'::public.company_role,
            'gerant'::public.company_role,
            'comptable'::public.company_role
          ])
        )
      )));
    $policy$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_invoice_status_after_payment'
  ) then
    create trigger trg_invoice_status_after_payment
      after insert or delete or update on public.payments
      for each row
      execute function public.refresh_invoice_status();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_invoices_recompute_on_change'
  ) then
    create trigger trg_invoices_recompute_on_change
      after update of tax_rate, stamp_included, stamp_amount on public.invoices
      for each row
      execute function public.trg_invoices_recompute_on_change();
  end if;
end $$;


