-- Add bank_accounts column to companies table for storing RIB information
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS bank_accounts jsonb DEFAULT '[]'::jsonb;

-- Add legal_name column as alias for name (for Settings page compatibility)  
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS legal_name text;

-- Add matricule_fiscale column if not exists
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS matricule_fiscale text;