-- Add signature and stamp URL columns to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN signature_url TEXT,
ADD COLUMN stamp_url TEXT;

-- Create storage bucket for company assets (signatures, stamps, logos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for company-assets bucket
CREATE POLICY "Users can upload their own company assets"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'company-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own company assets"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'company-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own company assets"
ON storage.objects
FOR DELETE
USING (bucket_id = 'company-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Company assets are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'company-assets');