-- Ensure source_invoice_id exists before any functions depend on it
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS source_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_source_invoice ON public.invoices(source_invoice_id);
