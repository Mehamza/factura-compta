-- Add bank accounts JSONB column to companies for storing RIBs
-- Safe to run multiple times
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS bank_accounts jsonb DEFAULT '[]'::jsonb;