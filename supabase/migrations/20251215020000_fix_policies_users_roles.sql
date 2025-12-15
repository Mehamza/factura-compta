-- Fix policies to use correct has_role signature: has_role(user_id, role)

-- Drop existing policies if they exist
DO $$ BEGIN
  DROP POLICY IF EXISTS profiles_manage ON public.profiles;
  DROP POLICY IF EXISTS profiles_update ON public.profiles;
  DROP POLICY IF EXISTS profiles_delete ON public.profiles;
  DROP POLICY IF EXISTS user_roles_insert ON public.user_roles;
  DROP POLICY IF EXISTS user_roles_update ON public.user_roles;
  DROP POLICY IF EXISTS user_roles_delete ON public.user_roles;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Recreate with correct argument order
create policy if not exists profiles_manage on public.profiles
  for insert with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'manager')
  );

create policy if not exists profiles_update on public.profiles
  for update using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'manager')
  ) with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'manager')
  );

create policy if not exists profiles_delete on public.profiles
  for delete using (public.has_role(auth.uid(), 'admin'));

create policy if not exists user_roles_insert on public.user_roles
  for insert with check (
    public.has_role(auth.uid(), 'admin')
    or (
      public.has_role(auth.uid(), 'manager')
      and (new.role != 'admin')
    )
  );

create policy if not exists user_roles_update on public.user_roles
  for update using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'manager')
  ) with check (
    public.has_role(auth.uid(), 'admin')
    or (public.has_role(auth.uid(), 'manager') and (new.role != 'admin'))
  );

create policy if not exists user_roles_delete on public.user_roles
  for delete using (
    public.has_role(auth.uid(), 'admin')
    or (public.has_role(auth.uid(), 'manager') and (old.role != 'admin'))
  );
