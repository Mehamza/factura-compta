-- Phase 4: Update handle_new_user trigger to auto-create company for new users

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
  user_name text;
BEGIN
  -- Insert/update profile
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email)
  ON CONFLICT (user_id) DO UPDATE
    SET email = excluded.email,
        full_name = COALESCE(excluded.full_name, public.profiles.full_name);

  -- Create a company for the new user
  user_name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'company_name', 'Entreprise');
  
  INSERT INTO public.companies (legal_name, type, is_configured)
  VALUES (user_name, 'personne_physique', false)
  RETURNING id INTO new_company_id;

  -- Link user as company_admin
  INSERT INTO public.company_users (user_id, company_id, role)
  VALUES (new.id, new_company_id, 'company_admin');

  -- Assign admin role to new user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN new;
END;
$$;