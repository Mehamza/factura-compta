-- Merge company_settings into companies table
-- Step 1: Add all settings columns to companies table

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS logo_url text,

ADD COLUMN IF NOT EXISTS activity text,
ADD COLUMN IF NOT EXISTS company_country text DEFAULT 'Tunisie',
ADD COLUMN IF NOT EXISTS company_vat_number text,
ADD COLUMN IF NOT EXISTS company_tax_id text,
ADD COLUMN IF NOT EXISTS company_trade_register text,
ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'TND',
ADD COLUMN IF NOT EXISTS default_vat_rate numeric DEFAULT 19,
ADD COLUMN IF NOT EXISTS signature_url text,
ADD COLUMN IF NOT EXISTS stamp_url text,
ADD COLUMN IF NOT EXISTS invoice_prefix text DEFAULT 'FAC',
ADD COLUMN IF NOT EXISTS invoice_format text DEFAULT '{prefix}-{year}-{number}',
ADD COLUMN IF NOT EXISTS invoice_next_number integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS invoice_number_padding integer DEFAULT 4,
ADD COLUMN IF NOT EXISTS vat_rates jsonb DEFAULT
  '[{"rate": 0, "label": "Exonéré"},
    {"rate": 7, "label": "Réduit 7%"},
    {"rate": 13, "label": "Intermédiaire 13%"},
    {"rate": 19, "label": "Standard 19%"}]'::jsonb;


-- Step 2: Migrate data from company_settings to companies
-- We need to find which company each company_settings belongs to via user_id -> company_users
UPDATE public.companies c
SET 
  activity = cs.activity,
  company_country = COALESCE(cs.company_country, 'Tunisie'),
  company_vat_number = cs.company_vat_number,
  company_tax_id = cs.company_tax_id,
  company_trade_register = cs.company_trade_register,
  default_currency = COALESCE(cs.default_currency, 'TND'),
  default_vat_rate = COALESCE(cs.default_vat_rate, 19),
  signature_url = cs.signature_url,
  stamp_url = cs.stamp_url,
  invoice_prefix = COALESCE(cs.invoice_prefix, 'FAC'),
  invoice_format = COALESCE(cs.invoice_format, '{prefix}-{year}-{number}'),
  invoice_next_number = COALESCE(cs.invoice_next_number, 1),
  invoice_number_padding = COALESCE(cs.invoice_number_padding, 4),
  vat_rates = COALESCE(cs.vat_rates, '[{"rate": 0, "label": "Exonéré"}, {"rate": 7, "label": "Réduit 7%"}, {"rate": 13, "label": "Intermédiaire 13%"}, {"rate": 19, "label": "Standard 19%"}]'::jsonb),
  -- Also copy over address/phone/email if they're not set in companies but are set in company_settings
  address = COALESCE(c.address, cs.company_address),
  city = COALESCE(c.city, cs.company_city),
  postal_code = COALESCE(c.postal_code, cs.company_postal_code),
  phone = COALESCE(c.phone, cs.company_phone),
  email = COALESCE(c.email, cs.company_email),
  logo_url = COALESCE(c.logo_url, cs.company_logo_url)
FROM public.company_settings cs
JOIN public.company_users cu ON cu.user_id = cs.user_id AND cu.role = 'company_admin'
WHERE cu.company_id = c.id;

-- Step 3: Drop the company_settings table
DROP TABLE IF EXISTS public.company_settings CASCADE;