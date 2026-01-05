-- Fix recursive RLS policy on user_global_roles
-- The ugr_super_admin_manage policy calls has_global_role() which queries the same table, causing stack overflow

-- Drop the problematic policy
DROP POLICY IF EXISTS "ugr_super_admin_manage" ON public.user_global_roles;

-- Also drop duplicate select policies (we have two identical ones)
DROP POLICY IF EXISTS "Users can read their own global roles" ON public.user_global_roles;

-- Create a SECURITY DEFINER function that bypasses RLS to check super admin status
CREATE OR REPLACE FUNCTION public.is_super_admin_direct(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_global_roles 
    WHERE user_id = _user_id AND role = 'SUPER_ADMIN'
  )
$$;

-- Create proper policies that don't cause recursion
-- Super admins can manage all global roles (uses direct check without RLS)
CREATE POLICY "ugr_super_admin_manage" ON public.user_global_roles
  FOR ALL
  TO authenticated
  USING (public.is_super_admin_direct(auth.uid()))
  WITH CHECK (public.is_super_admin_direct(auth.uid()));