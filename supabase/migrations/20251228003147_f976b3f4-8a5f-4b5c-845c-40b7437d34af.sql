-- Phase 1: Multi-Tenant Company Architecture

-- 1. Create company type enum
CREATE TYPE public.company_type AS ENUM ('personne_physique', 'personne_morale');

-- 2. Create company role enum (company-scoped roles)
CREATE TYPE public.company_role AS ENUM ('company_admin', 'gerant', 'comptable', 'caissier');

-- 3. Create companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type company_type NOT NULL DEFAULT 'personne_physique',
  legal_name TEXT,
  matricule_fiscale TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  is_configured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 4. Create company_users pivot table
CREATE TABLE public.company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role company_role NOT NULL DEFAULT 'company_admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Enable RLS on company_users
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

-- 5. Create updated_at trigger for companies
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Security Definer Functions

-- Check if user belongs to a company
CREATE OR REPLACE FUNCTION public.user_in_company(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE user_id = _user_id AND company_id = _company_id
  )
$$;

-- Get user's company IDs as array
CREATE OR REPLACE FUNCTION public.get_user_company_ids(_user_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(company_id), '{}') FROM public.company_users WHERE user_id = _user_id
$$;

-- Get user's role in a specific company
CREATE OR REPLACE FUNCTION public.get_company_role(_user_id UUID, _company_id UUID)
RETURNS company_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.company_users 
  WHERE user_id = _user_id AND company_id = _company_id
  LIMIT 1
$$;

-- Check if user has specific role in company
CREATE OR REPLACE FUNCTION public.has_company_role(_user_id UUID, _company_id UUID, _role company_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE user_id = _user_id 
      AND company_id = _company_id 
      AND role = _role
  )
$$;

-- Check if user is company admin
CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE user_id = _user_id 
      AND company_id = _company_id 
      AND role = 'company_admin'
  )
$$;

-- Check if user is super admin (global)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
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

-- 7. RLS Policies for companies table

-- Users can view companies they belong to
CREATE POLICY "Users can view their companies"
ON public.companies
FOR SELECT
USING (
  public.user_in_company(auth.uid(), id)
  OR public.is_super_admin(auth.uid())
);

-- Company admins can update their companies
CREATE POLICY "Company admins can update their companies"
ON public.companies
FOR UPDATE
USING (
  public.is_company_admin(auth.uid(), id)
  OR public.is_super_admin(auth.uid())
);

-- Authenticated users can create companies (for signup flow)
CREATE POLICY "Authenticated users can create companies"
ON public.companies
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Super admins can delete companies
CREATE POLICY "Super admins can delete companies"
ON public.companies
FOR DELETE
USING (public.is_super_admin(auth.uid()));

-- 8. RLS Policies for company_users table

-- Users can view their own company memberships
CREATE POLICY "Users can view own memberships"
ON public.company_users
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
);

-- Company admins can view all memberships in their company
CREATE POLICY "Company admins can view company memberships"
ON public.company_users
FOR SELECT
USING (
  public.is_company_admin(auth.uid(), company_id)
);

-- Company admins can add members to their company
CREATE POLICY "Company admins can add members"
ON public.company_users
FOR INSERT
WITH CHECK (
  public.is_company_admin(auth.uid(), company_id)
  OR auth.uid() = user_id -- Allow self-registration during signup
);

-- Company admins can update member roles in their company
CREATE POLICY "Company admins can update member roles"
ON public.company_users
FOR UPDATE
USING (
  public.is_company_admin(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
);

-- Company admins can remove members from their company
CREATE POLICY "Company admins can remove members"
ON public.company_users
FOR DELETE
USING (
  public.is_company_admin(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
);