-- Add FODEC fields to products
ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS fodec_applicable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fodec_rate numeric DEFAULT 0.01;

-- Add FODEC fields to invoice_items
ALTER TABLE IF EXISTS public.invoice_items
  ADD COLUMN IF NOT EXISTS fodec_applicable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fodec_rate numeric DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS fodec_amount numeric DEFAULT 0;

-- Add FODEC total to invoices (header)
ALTER TABLE IF EXISTS public.invoices
  ADD COLUMN IF NOT EXISTS fodec_amount numeric DEFAULT 0;

-- Optional: create view helpers could be added later
