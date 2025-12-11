-- Create company_settings table for fiscal and invoice configuration
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  -- Données fiscales de l'entreprise
  company_name text,
  company_address text,
  company_city text,
  company_postal_code text,
  company_country text DEFAULT 'Tunisie',
  company_phone text,
  company_email text,
  company_vat_number text,
  company_tax_id text,
  company_trade_register text,
  company_logo_url text,
  -- Configuration TVA (taux tunisiens)
  default_vat_rate numeric DEFAULT 19,
  vat_rates jsonb DEFAULT '[{"rate": 0, "label": "Exonéré"}, {"rate": 7, "label": "Réduit 7%"}, {"rate": 13, "label": "Intermédiaire 13%"}, {"rate": 19, "label": "Standard 19%"}]'::jsonb,
  -- Numérotation factures
  invoice_prefix text DEFAULT 'FAC',
  invoice_next_number integer DEFAULT 1,
  invoice_format text DEFAULT '{prefix}-{year}-{number}',
  invoice_number_padding integer DEFAULT 4,
  -- Métadonnées
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own settings"
  ON public.company_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings"
  ON public.company_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON public.company_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();