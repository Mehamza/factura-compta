-- Add purchase-quote related columns and allow new status 'purchase_quote'
-- NOTE: This migration *adds* the new status to the check constraint but DOES NOT migrate existing 'draft' rows.
-- Option 2 chosen: existing draft rows remain unchanged.

alter table if exists public.invoices
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null,
  add column if not exists validity_date date,
  add column if not exists reference_devis text;

-- Try to drop existing inline check constraint (if named invoices_status_check), then add an explicit constraint including the new status
alter table if exists public.invoices drop constraint if exists invoices_status_check;

alter table if exists public.invoices
  add constraint invoices_status_check check (status in ('draft','purchase_quote','sent','paid','overdue','cancelled'));

-- Preserve RLS and other policies; no data migration performed here.
