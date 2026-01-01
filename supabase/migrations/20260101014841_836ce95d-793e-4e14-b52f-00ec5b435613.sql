-- Add unique constraint on profiles for user_id to support ON CONFLICT
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);