-- Unify invoice flows using a single `invoices.status` column:
-- - For invoice kinds (facture/facture_achat + legacy facture_*): status is payment-driven
--   (draft|unpaid|partial|overdue|paid|cancelled)
-- - For other document kinds: status is lifecycle-driven
--   (draft|validated|cancelled)
--
-- This migration:
-- 1) Drops the old constraint (which may block 'validated'/'unpaid')
-- 2) Normalizes existing rows
-- 3) Re-adds a conditional constraint based on document_kind

begin;

-- 1) Drop constraint first to avoid violations during normalization.
alter table public.invoices drop constraint if exists invoices_status_check;

-- 2) Normalize statuses.
-- Invoice kinds => collapse legacy workflow statuses to payment-driven statuses.
-- Other kinds  => collapse legacy workflow statuses to validated/cancelled.
update public.invoices
set status = case
  when status is null then 'draft'
  when status in ('draft','cancelled') then status

  -- Invoice kinds (sales/purchase invoices)
  when document_kind in ('facture','facture_achat','facture_credit','facture_payee','facture_credit_achat') then
    case
      when status in ('paid','partial','overdue','unpaid') then status
      else 'unpaid'
    end

  -- Non-invoice kinds
  else
    case
      when status = 'validated' then 'validated'
      when status in ('rejected','expired') then 'cancelled'
      else 'validated'
    end
end
where status is not null or status is null;

-- 3) Recreate constraint with kind-dependent allowed statuses.
alter table public.invoices
  add constraint invoices_status_check
  check (
    (
      document_kind in ('facture','facture_achat','facture_credit','facture_payee','facture_credit_achat')
      and status in ('draft','unpaid','partial','overdue','paid','cancelled')
    )
    or
    (
      document_kind not in ('facture','facture_achat','facture_credit','facture_payee','facture_credit_achat')
      and status in ('draft','validated','cancelled')
    )
  );

commit;
