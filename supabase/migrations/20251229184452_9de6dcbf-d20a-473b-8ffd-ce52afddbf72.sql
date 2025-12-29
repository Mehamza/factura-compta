-- Drop the empty trigger that's causing the error
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;

-- Also drop the empty function since it's not needed
DROP FUNCTION IF EXISTS public.handle_new_user_role();