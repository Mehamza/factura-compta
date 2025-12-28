-- Phase 3: Migrate existing users to companies
-- For each user with role 'admin', create a company and link their data

-- Create a company for each admin user and link them
DO $$
DECLARE
  admin_record RECORD;
  new_company_id uuid;
  profile_name text;
BEGIN
  -- Loop through all admin users
  FOR admin_record IN 
    SELECT DISTINCT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.role = 'admin'
  LOOP
    -- Get profile info for company name
    SELECT COALESCE(p.company_name, p.full_name, 'Entreprise') INTO profile_name
    FROM public.profiles p 
    WHERE p.user_id = admin_record.user_id;
    
    -- Check if user already has a company
    IF NOT EXISTS (
      SELECT 1 FROM public.company_users cu WHERE cu.user_id = admin_record.user_id
    ) THEN
      -- Create a new company
      INSERT INTO public.companies (legal_name, type, is_configured)
      VALUES (COALESCE(profile_name, 'Entreprise'), 'personne_physique', false)
      RETURNING id INTO new_company_id;
      
      -- Link user as company_admin
      INSERT INTO public.company_users (user_id, company_id, role)
      VALUES (admin_record.user_id, new_company_id, 'company_admin');
      
      -- Update all business tables for this user
      UPDATE public.invoices SET company_id = new_company_id WHERE user_id = admin_record.user_id AND company_id IS NULL;
      UPDATE public.payments SET company_id = new_company_id WHERE user_id = admin_record.user_id AND company_id IS NULL;
      UPDATE public.products SET company_id = new_company_id WHERE user_id = admin_record.user_id AND company_id IS NULL;
      UPDATE public.stock_movements SET company_id = new_company_id WHERE user_id = admin_record.user_id AND company_id IS NULL;
      UPDATE public.clients SET company_id = new_company_id WHERE user_id = admin_record.user_id AND company_id IS NULL;
      UPDATE public.suppliers SET company_id = new_company_id WHERE user_id = admin_record.user_id AND company_id IS NULL;
      UPDATE public.journal_entries SET company_id = new_company_id WHERE user_id = admin_record.user_id AND company_id IS NULL;
      UPDATE public.accounts SET company_id = new_company_id WHERE user_id = admin_record.user_id AND company_id IS NULL;
      UPDATE public.documents SET company_id = new_company_id WHERE user_id = admin_record.user_id AND company_id IS NULL;
    END IF;
  END LOOP;
END $$;