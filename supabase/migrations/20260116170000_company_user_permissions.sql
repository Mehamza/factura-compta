-- Add per-user (per-company) module permissions.
-- Roles remain labels; module access is controlled by company_users.permissions.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'company_users'
      AND column_name = 'permissions'
  ) THEN
    ALTER TABLE public.company_users
      ADD COLUMN permissions jsonb NOT NULL DEFAULT '{"allow":["*"]}'::jsonb;
  END IF;
END $$;

-- Propagate optional permissions from auth.users.raw_user_meta_data into company_users on invite.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_company_id uuid;
  user_name text;
  is_employee boolean;
  invited_company_id uuid;
  desired_role public.app_role;
  company_role_value public.company_role;
  requested_permissions jsonb;
BEGIN
  is_employee := COALESCE((NEW.raw_user_meta_data->>'is_employee')::boolean, false);
  invited_company_id := NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid;
  desired_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role','')::public.app_role, 'cashier'::public.app_role);

  requested_permissions := NEW.raw_user_meta_data->'permissions';
  IF requested_permissions IS NULL THEN
    requested_permissions := '{"allow":["*"]}'::jsonb;
  END IF;

  -- Map app_role to company_role
  company_role_value := CASE desired_role::text
    WHEN 'admin' THEN 'company_admin'::public.company_role
    WHEN 'manager' THEN 'gerant'::public.company_role
    WHEN 'accountant' THEN 'comptable'::public.company_role
    WHEN 'cashier' THEN 'caissier'::public.company_role
    ELSE 'caissier'::public.company_role
  END;

  -- Always: upsert profile
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
  ON CONFLICT (user_id) DO UPDATE
    SET email = excluded.email,
        full_name = COALESCE(excluded.full_name, public.profiles.full_name);

  IF is_employee THEN
    -- Employee path: no company creation
    IF invited_company_id IS NOT NULL THEN
      INSERT INTO public.company_users (user_id, company_id, role, permissions)
      VALUES (NEW.id, invited_company_id, company_role_value, requested_permissions)
      ON CONFLICT (user_id, company_id) DO NOTHING;
    END IF;

    -- Set app role (legacy label)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, desired_role)
    ON CONFLICT (user_id) DO UPDATE SET role = excluded.role;

    RETURN NEW;
  END IF;

  -- Owner path: create company
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'company_name', 'Entreprise');

  INSERT INTO public.companies (name)
  VALUES (user_name)
  RETURNING id INTO new_company_id;

  INSERT INTO public.company_users (user_id, company_id, role, permissions)
  VALUES (NEW.id, new_company_id, 'company_admin', requested_permissions)
  ON CONFLICT (user_id, company_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin'::public.app_role)
  ON CONFLICT (user_id) DO UPDATE SET role = excluded.role;

  RETURN NEW;
END;
$$;
