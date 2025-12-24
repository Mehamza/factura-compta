-- Add reference, vat_rate, and vat_amount columns to invoice_items
ALTER TABLE public.invoice_items 
ADD COLUMN IF NOT EXISTS reference text,
ADD COLUMN IF NOT EXISTS vat_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_amount numeric DEFAULT 0;