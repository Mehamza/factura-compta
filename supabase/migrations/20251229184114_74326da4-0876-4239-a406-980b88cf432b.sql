-- Create the trigger that calls handle_new_user on new user creation in auth.users
-- The function already exists and is correct, but the trigger was missing

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();