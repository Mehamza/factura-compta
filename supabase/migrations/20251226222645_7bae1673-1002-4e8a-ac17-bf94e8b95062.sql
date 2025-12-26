-- Add owner_id column to profiles table to link team members to their company admin
ALTER TABLE public.profiles 
ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- For existing admin users, set their owner_id to themselves (they are their own owner)
-- This will be set by the edge function for new users

-- Update RLS policy to allow admins to see profiles of users they created (their team)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Admins can view profiles of their team members (users they created)
CREATE POLICY "Admins can view team profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = owner_id);

-- Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM user_global_roles 
  WHERE user_global_roles.user_id = auth.uid() 
  AND user_global_roles.role = 'SUPER_ADMIN'
));

-- Allow admins to update profiles of their team members
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can update team profiles" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = owner_id);

-- Allow admins to delete profiles of their team members
CREATE POLICY "Admins can delete team profiles" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = owner_id);

-- Update user_roles RLS to allow admins to see roles of their team members
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Users can view their own roles
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Admins can view roles of their team members
CREATE POLICY "Admins can view team roles" 
ON public.user_roles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = user_roles.user_id 
    AND profiles.owner_id = auth.uid()
  )
);

-- Admins can manage roles of their team members
CREATE POLICY "Admins can manage team roles" 
ON public.user_roles 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = user_roles.user_id 
    AND profiles.owner_id = auth.uid()
  )
);

-- Admins can manage their own roles
CREATE POLICY "Admins can manage own roles" 
ON public.user_roles 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);