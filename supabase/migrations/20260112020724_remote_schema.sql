drop trigger if exists "trg_invoice_items_compute_amounts" on "public"."invoice_items";

drop trigger if exists "trg_invoice_items_sales_constraints" on "public"."invoice_items";

drop trigger if exists "trg_enforce_credit_note_source_company" on "public"."invoices";

drop trigger if exists "trg_enforce_credit_note_stamp" on "public"."invoices";

drop trigger if exists "trg_invoices_recompute_payment_status" on "public"."invoices";

drop trigger if exists "trg_invoices_sales_constraints" on "public"."invoices";

drop trigger if exists "trg_prevent_delete_validated_invoice" on "public"."invoices";

drop trigger if exists "trg_prevent_update_validated_credit_note" on "public"."invoices";

drop trigger if exists "update_warehouse_products_updated_at" on "public"."warehouse_products";

drop trigger if exists "prevent_delete_default_warehouse_trg" on "public"."warehouses";

drop trigger if exists "trg_invoices_recompute_on_change" on "public"."invoices";

alter table "public"."invoices" drop constraint "invoices_payment_status_check";

alter table "public"."stock_movements" drop constraint "stock_movements_destination_warehouse_id_fkey";

alter table "public"."stock_movements" drop constraint "stock_movements_source_warehouse_id_fkey";

alter table "public"."stock_movements" drop constraint "stock_movements_warehouse_id_fkey";

alter table "public"."warehouse_products" drop constraint "warehouse_products_max_nonneg";

alter table "public"."warehouse_products" drop constraint "warehouse_products_min_le_max";

alter table "public"."warehouse_products" drop constraint "warehouse_products_min_nonneg";

alter table "public"."warehouse_products" drop constraint "warehouse_products_qty_nonneg";

drop function if exists "public"."_invoice_discount_ratio"(p_invoice_id uuid);

drop function if exists "public"."_trg_validate_invoice_items_sales_constraints"();

drop function if exists "public"."_trg_validate_invoice_sales_constraints"();

drop function if exists "public"."apply_warehouse_stock_movement"(p_company_id uuid, p_user_id uuid, p_kind text, p_product_id uuid, p_quantity numeric, p_warehouse_id uuid, p_source_warehouse_id uuid, p_destination_warehouse_id uuid, p_reference_type text, p_reference_id uuid, p_note text);

drop function if exists "public"."enforce_credit_note_source_company"();

drop function if exists "public"."enforce_credit_note_stamp"();

drop function if exists "public"."enforce_sales_invoice_constraints"(p_invoice_id uuid);

drop function if exists "public"."get_default_warehouse_id"(p_company_id uuid);

drop function if exists "public"."prevent_delete_default_warehouse"();

drop function if exists "public"."prevent_delete_validated_invoice"();

drop function if exists "public"."prevent_update_validated_credit_note"();

drop function if exists "public"."recompute_invoice_payment_status"(p_invoice_id uuid);

drop function if exists "public"."trg_invoice_items_compute_amounts"();

drop function if exists "public"."trg_invoices_recompute_payment_status"();

drop index if exists "public"."idx_invoices_source_invoice_id";

drop index if exists "public"."stock_movements_company_created_idx";

drop index if exists "public"."stock_movements_src_dest_idx";

drop index if exists "public"."stock_movements_wh_product_idx";

drop index if exists "public"."warehouse_products_product_idx";

drop index if exists "public"."warehouse_products_wh_product_uq";

drop index if exists "public"."warehouses_company_active_idx";

drop index if exists "public"."warehouses_company_code_uq";

drop index if exists "public"."warehouses_one_default_per_company_uq";

alter table "public"."invoices" drop column "payment_status";

alter table "public"."stock_movements" drop column "destination_warehouse_id";

alter table "public"."stock_movements" drop column "source_warehouse_id";

alter table "public"."stock_movements" drop column "warehouse_id";

alter table "public"."warehouse_products" drop column "max_quantity";

alter table "public"."warehouse_products" drop column "min_quantity";

alter table "public"."warehouse_products" add column "max_stock" numeric;

alter table "public"."warehouse_products" add column "min_stock" numeric default 0;

alter table "public"."warehouse_products" alter column "created_at" drop not null;

alter table "public"."warehouse_products" alter column "quantity" drop not null;

alter table "public"."warehouse_products" alter column "updated_at" drop not null;

alter table "public"."warehouses" alter column "country" set default 'Tunisie'::text;

alter table "public"."warehouses" alter column "created_at" drop not null;

alter table "public"."warehouses" alter column "is_active" drop not null;

alter table "public"."warehouses" alter column "is_default" drop not null;

alter table "public"."warehouses" alter column "updated_at" drop not null;

CREATE UNIQUE INDEX warehouse_products_warehouse_id_product_id_key ON public.warehouse_products USING btree (warehouse_id, product_id);

alter table "public"."warehouse_products" add constraint "warehouse_products_warehouse_id_product_id_key" UNIQUE using index "warehouse_products_warehouse_id_product_id_key";

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

CREATE TRIGGER trg_invoice_status_after_payment AFTER INSERT OR DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.refresh_invoice_status();

CREATE TRIGGER trg_invoices_recompute_on_change AFTER UPDATE OF tax_rate, stamp_included, stamp_amount ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.trg_invoices_recompute_on_change();


