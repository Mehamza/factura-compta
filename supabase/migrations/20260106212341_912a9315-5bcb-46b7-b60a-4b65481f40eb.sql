-- Add company deactivation fields and audit logging for Super Admin company management

-- Add deactivation fields to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS disabled_until timestamptz NULL,
ADD COLUMN IF NOT EXISTS disabled_reason text NULL,
ADD COLUMN IF NOT EXISTS disabled_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS disabled_by uuid NULL;

-- Create company status audit log table
CREATE TABLE IF NOT EXISTS public.company_status_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'activate', 'deactivate_temporary', 'deactivate_permanent', 'auto_reactivate'
  reason text NULL,
  disabled_until timestamptz NULL,
  performed_by uuid NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NULL
);

-- Enable RLS on company_status_logs
ALTER TABLE public.company_status_logs ENABLE ROW LEVEL SECURITY;

-- Only Super Admins can read/write company status logs
CREATE POLICY "Super admins can manage company status logs"
  ON public.company_status_logs
  FOR ALL
  TO authenticated
  USING (public.is_super_admin_direct(auth.uid()))
  WITH CHECK (public.is_super_admin_direct(auth.uid()));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_status_logs_company_id ON public.company_status_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_disabled_until ON public.companies(disabled_until) WHERE disabled_until IS NOT NULL;

-- Create function to check if company is currently disabled
CREATE OR REPLACE FUNCTION public.is_company_disabled(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT 
    NOT active 
    OR (disabled_until IS NOT NULL AND disabled_until > now())
  FROM public.companies 
  WHERE id = p_company_id
$$;

-- Create function to auto-reactivate expired temporary deactivations
-- This will be called by a scheduled edge function
CREATE OR REPLACE FUNCTION public.auto_reactivate_companies()
RETURNS TABLE(company_id uuid, company_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT id, name 
    FROM public.companies 
    WHERE active = false 
      AND disabled_until IS NOT NULL 
      AND disabled_until <= now()
  LOOP
    -- Reactivate the company
    UPDATE public.companies 
    SET 
      active = true, 
      disabled_until = NULL,
      disabled_reason = NULL,
      disabled_at = NULL,
      disabled_by = NULL
    WHERE id = r.id;
    
    -- Log the auto-reactivation (use a system UUID for automated actions)
    INSERT INTO public.company_status_logs (
      company_id, 
      action, 
      reason, 
      performed_by,
      metadata
    ) VALUES (
      r.id, 
      'auto_reactivate', 
      'Réactivation automatique après expiration de la période de désactivation',
      '00000000-0000-0000-0000-000000000000'::uuid, -- System user
      jsonb_build_object('automated', true)
    );
    
    company_id := r.id;
    company_name := r.name;
    RETURN NEXT;
  END LOOP;
END;
$$;