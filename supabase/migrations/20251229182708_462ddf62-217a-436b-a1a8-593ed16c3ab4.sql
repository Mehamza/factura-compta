-- Fix the handle_new_user trigger with correct PL/pgSQL CASE syntax
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

  -- Map app_role to company_role using proper PL/pgSQL CASE expression
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