-- Create super admin user with email medhamzaallagui7@gmail.com and password hamza2026**
-- First we need to ensure the user exists in auth.users, then add to user_global_roles

-- Check if user already exists and get/create their ID
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Check if user exists in auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'medhamzaallagui7@gmail.com';
  
  -- If user exists, add super admin role
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_global_roles (user_id, role)
    VALUES (v_user_id, 'SUPER_ADMIN')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Note: If the user doesn't exist yet, they need to sign up first with email medhamzaallagui7@gmail.com and password hamza2026**
-- After signup, manually add to user_global_roles or run this again