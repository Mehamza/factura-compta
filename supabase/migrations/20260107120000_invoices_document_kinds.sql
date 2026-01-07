-- Add a document_kind column to support multiple document types (devis/BC/BL/facture/reçu)
-- Keeps existing logic intact and is safe across deployments.

DO $$
BEGIN
  -- 1) Add document_kind if missing
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'document_kind'
  ) THEN
    ALTER TABLE public.invoices
      ADD COLUMN document_kind text NOT NULL DEFAULT 'facture_credit';
  END IF;

  -- 2) If a legacy column `document_type` exists and marks purchases, map them to achat kind.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'document_type'
  ) THEN
    EXECUTE 'UPDATE public.invoices
             SET document_kind = ''facture_credit_achat''
             WHERE document_type = ''purchase''';
  END IF;

  -- 3) Relax status constraint to allow all document workflows.
  --    (If the constraint doesn't exist, this is a no-op.)
  EXECUTE 'ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check';

  EXECUTE 'ALTER TABLE public.invoices
           ADD CONSTRAINT invoices_status_check
           CHECK (
             status IN (
               ''draft'',
               ''sent'',
               ''accepted'',
               ''rejected'',
               ''expired'',
               ''confirmed'',
               ''delivered'',
               ''paid'',
               ''overdue'',
               ''partial'',
               ''cancelled'',
               ''purchase_quote''
             )
           )';

  -- 4) Index for fast per-kind listing
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_invoices_company_kind'
  ) THEN
    CREATE INDEX idx_invoices_company_kind
      ON public.invoices(company_id, document_kind, created_at DESC);
  END IF;
END $$;
