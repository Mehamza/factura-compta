-- Create helper function public.has_role(role text, user_id uuid)
create or replace function public.has_role(p_role text, p_user_id uuid)
returns boolean language sql stable as $fn$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_user_id and lower(ur.role::text) = lower(p_role)
  );
$fn$;
