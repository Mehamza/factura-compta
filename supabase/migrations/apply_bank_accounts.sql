-- Add bank_accounts column if it doesn't exist
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS bank_accounts jsonb DEFAULT '[]'::jsonb;
