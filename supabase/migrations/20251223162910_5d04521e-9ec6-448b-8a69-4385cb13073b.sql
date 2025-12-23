-- Add stamp columns to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS stamp_included boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stamp_amount numeric DEFAULT 0;