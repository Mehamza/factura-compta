-- Remote schema adjustments (invoice payment_status)
-- NOTE: intentionally limited to invoices; do not touch stock/warehouses here.

drop trigger if exists "trg_invoice_items_compute_amounts" on "public"."invoice_items";
drop trigger if exists "trg_invoice_items_sales_constraints" on "public"."invoice_items";
drop trigger if exists "trg_enforce_credit_note_source_company" on "public"."invoices";
drop trigger if exists "trg_enforce_credit_note_stamp" on "public"."invoices";
drop trigger if exists "trg_invoices_recompute_payment_status" on "public"."invoices";
drop trigger if exists "trg_invoices_sales_constraints" on "public"."invoices";
drop trigger if exists "trg_prevent_delete_validated_invoice" on "public"."invoices";
drop trigger if exists "trg_prevent_update_validated_credit_note" on "public"."invoices";
drop trigger if exists "trg_invoices_recompute_on_change" on "public"."invoices";

alter table public.invoices add column if not exists payment_status text;

do $$
begin
   if exists (
      select 1
      from information_schema.table_constraints
      where table_schema = 'public'
         and table_name = 'invoices'
         and constraint_name = 'invoices_payment_status_check'
   ) then
      alter table public.invoices drop constraint invoices_payment_status_check;
   end if;

   if not exists (
      select 1
      from pg_constraint
      where conname = 'invoices_payment_status_check'
   ) then
      alter table public.invoices
         add constraint invoices_payment_status_check
         check (payment_status in ('paid','unpaid','partial'));
   end if;
end $$;
