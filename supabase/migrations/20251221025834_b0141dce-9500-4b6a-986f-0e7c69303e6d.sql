-- Create impersonation_logs table for auditing Super Admin impersonation events
CREATE TABLE public.impersonation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('start', 'end')),
  created_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

-- Enable Row-Level Security
ALTER TABLE public.impersonation_logs ENABLE ROW LEVEL SECURITY;

-- Only Super Admins can view impersonation logs
CREATE POLICY "Super admins can view impersonation logs"
ON public.impersonation_logs
FOR SELECT
USING (has_global_role('SUPER_ADMIN', auth.uid()));

-- Only Super Admins can insert impersonation logs (via edge function with service role)
CREATE POLICY "Super admins can insert impersonation logs"
ON public.impersonation_logs
FOR INSERT
WITH CHECK (has_global_role('SUPER_ADMIN', auth.uid()));