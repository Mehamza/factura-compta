-- Ajouter les nouveaux champs à company_settings
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'TND',
ADD COLUMN IF NOT EXISTS activity text;

-- Ajouter les nouveaux champs aux factures
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'TND',
ADD COLUMN IF NOT EXISTS template_type text DEFAULT 'classic',
ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id);

-- Créer un index pour les recherches par utilisateur créateur
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON public.invoices(created_by_user_id);