ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS company_id UUID
REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.stock_movements
ADD COLUMN IF NOT EXISTS company_id UUID
REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS company_id UUID
REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS company_id UUID
REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.journal_entries
ADD COLUMN IF NOT EXISTS company_id UUID
REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS company_id UUID
REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS company_id UUID
REFERENCES public.companies(id) ON DELETE CASCADE;
