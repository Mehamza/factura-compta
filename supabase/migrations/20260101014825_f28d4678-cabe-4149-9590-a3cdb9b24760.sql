-- Add unique constraint on user_roles for user_id to support ON CONFLICT
ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);