-- Drop the existing status check constraint
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Add new constraint that includes 'devis' status
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check 
CHECK (status = ANY (ARRAY['draft', 'sent', 'paid', 'overdue', 'cancelled', 'devis']));