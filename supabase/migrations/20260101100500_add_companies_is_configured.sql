-- Add is_configured flag to companies to mark setup completion
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS is_configured boolean DEFAULT false;