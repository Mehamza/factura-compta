-- Fix cross-company user visibility and management.
--
-- Root cause: overly broad RLS policies (`profiles_read`, `user_roles_read`) allowed any authenticated user
-- to SELECT all rows from `profiles` and `user_roles`, causing cross-company leakage.
--
-- This migration:
-- - Removes permissive/global policies.
-- - Replaces team-management policies with company-scoped policies based on `company_users`.
-- - Extends `company_users` management permissions to company admins and managers (gerant).

-- Safety: ensure RLS is on
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.company_users enable row level security;

-- Helper: do two users share at least one company?
create or replace function public.users_share_company(_actor uuid, _target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_users cu_actor
    join public.company_users cu_target
      on cu_target.company_id = cu_actor.company_id
    where cu_actor.user_id = _actor
      and cu_target.user_id = _target
  );
$$;

-- Helper: who can manage a company's team/memberships?
create or replace function public.can_manage_company_users(_user_id uuid, _company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_users cu
    where cu.user_id = _user_id
      and cu.company_id = _company_id
      and cu.role in ('company_admin'::public.company_role, 'gerant'::public.company_role)
  );
$$;

-- --- company_users policies (allow company_admin + gerant) ---
DROP POLICY IF EXISTS "Company admins can view company memberships" ON public.company_users;
DROP POLICY IF EXISTS "Company admins can add members" ON public.company_users;
DROP POLICY IF EXISTS "Company admins can update member roles" ON public.company_users;
DROP POLICY IF EXISTS "Company admins can remove members" ON public.company_users;

CREATE POLICY "Team managers can view company memberships"
ON public.company_users
FOR SELECT
USING (
  public.can_manage_company_users(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Team managers can add members"
ON public.company_users
FOR INSERT
WITH CHECK (
  public.can_manage_company_users(auth.uid(), company_id)
  OR auth.uid() = user_id
);

CREATE POLICY "Team managers can update member roles"
ON public.company_users
FOR UPDATE
USING (
  public.can_manage_company_users(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Team managers can remove members"
ON public.company_users
FOR DELETE
USING (
  public.can_manage_company_users(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
);

-- --- profiles policies ---
-- Remove permissive policies and legacy owner_id-based team policies.
DROP POLICY IF EXISTS profiles_read ON public.profiles;
DROP POLICY IF EXISTS profiles_manage ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
DROP POLICY IF EXISTS profiles_delete ON public.profiles;
DROP POLICY IF EXISTS "Admins can view team profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update team profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete team profiles" ON public.profiles;

-- Allow admins/managers to view/update/delete profiles of users in the same company.
CREATE POLICY "Team managers can view company profiles"
ON public.profiles
FOR SELECT
USING (
  (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
  AND public.users_share_company(auth.uid(), user_id)
);

CREATE POLICY "Team managers can update company profiles"
ON public.profiles
FOR UPDATE
USING (
  (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
  AND public.users_share_company(auth.uid(), user_id)
)
WITH CHECK (
  (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
  AND public.users_share_company(auth.uid(), user_id)
);

CREATE POLICY "Team managers can delete company profiles"
ON public.profiles
FOR DELETE
USING (
  (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
  AND public.users_share_company(auth.uid(), user_id)
);

-- --- user_roles policies ---
-- Remove permissive policies and legacy owner_id-based team policies.
DROP POLICY IF EXISTS user_roles_read ON public.user_roles;
DROP POLICY IF EXISTS user_roles_insert ON public.user_roles;
DROP POLICY IF EXISTS user_roles_update ON public.user_roles;
DROP POLICY IF EXISTS user_roles_delete ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view team roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage team roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage own roles" ON public.user_roles;

-- View roles of users in the same company (admin/manager only)
CREATE POLICY "Team managers can view company roles"
ON public.user_roles
FOR SELECT
USING (
  (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
  AND public.users_share_company(auth.uid(), user_id)
);

-- Insert role rows for users in the same company
CREATE POLICY "Team managers can insert company roles"
ON public.user_roles
FOR INSERT
WITH CHECK (
  public.users_share_company(auth.uid(), user_id)
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'manager'::public.app_role)
      AND role <> 'admin'::public.app_role
    )
  )
);

-- Update role rows for users in the same company
CREATE POLICY "Team managers can update company roles"
ON public.user_roles
FOR UPDATE
USING (
  public.users_share_company(auth.uid(), user_id)
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'manager'::public.app_role)
      AND role <> 'admin'::public.app_role
    )
  )
)
WITH CHECK (
  public.users_share_company(auth.uid(), user_id)
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'manager'::public.app_role)
      AND role <> 'admin'::public.app_role
    )
  )
);

-- Delete role rows for users in the same company
CREATE POLICY "Team managers can delete company roles"
ON public.user_roles
FOR DELETE
USING (
  public.users_share_company(auth.uid(), user_id)
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'manager'::public.app_role)
      AND role <> 'admin'::public.app_role
    )
  )
);
