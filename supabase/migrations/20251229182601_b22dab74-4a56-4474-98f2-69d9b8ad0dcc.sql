-- Fix the handle_new_user trigger to properly cast role to company_role enum
-- The trigger receives role like 'accountant', 'cashier' etc. but company_users.role 
-- expects 'comptable', 'caissier' etc. (the company_role enum values)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_company_id uuid;
  user_name text;
  is_employee boolean;
  invited_company_id uuid;
  desired_role public.app_role;
  company_role_value public.company_role;
BEGIN
  is_employee := COALESCE((NEW.raw_user_meta_data->>'is_employee')::boolean, false);
  invited_company_id := NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid;
  desired_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role','')::public.app_role, 'cashier'::public.app_role);

  -- Map app_role to company_role
  -- app_role: admin, accountant, user, manager, cashier
  -- company_role: company_admin, gerant, comptable, caissier
  CASE desired_role::text
    WHEN 'admin' THEN company_role_value := 'company_admin'::public.company_role;
    WHEN 'manager' THEN company_role_value := 'gerant'::public.company_role;
    WHEN 'accountant' THEN company_role_value := 'comptable'::public.company_role;
    WHEN 'cashier' THEN company_role_value := 'caissier'::public.company_role;
    ELSE company_role_value := 'caissier'::public.company_role;
  END CASE;

  -- Always: upsert profile
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
  ON CONFLICT (user_id) DO UPDATE
    SET email = excluded.email,
        full_name = COALESCE(excluded.full_name, public.profiles.full_name);

  IF is_employee THEN
    -- Employee path: no company creation
    -- Link employee to existing company (only if provided)
    IF invited_company_id IS NOT NULL THEN
      INSERT INTO public.company_users (user_id, company_id, role)
      VALUES (NEW.id, invited_company_id, company_role_value)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Set app role to desired role (single-row per user)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, desired_role)
    ON CONFLICT (user_id) DO UPDATE SET role = excluded.role;

    RETURN NEW;
  END IF;

  -- Owner path (existing behavior)
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'company_name', 'Entreprise');

  INSERT INTO public.companies (legal_name, type, is_configured)
  VALUES (user_name, 'personne_physique', false)
  RETURNING id INTO new_company_id;

  INSERT INTO public.company_users (user_id, company_id, role)
  VALUES (NEW.id, new_company_id, 'company_admin');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin'::public.app_role)
  ON CONFLICT (user_id) DO UPDATE SET role = excluded.role;

  RETURN NEW;
END;
$function$;