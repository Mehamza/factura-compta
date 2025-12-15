-- Policies for profiles and user_roles enforcing role-based CRUD

-- Ensure RLS is enabled
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- Helper: has_role(user_id, role) is assumed to exist

-- Read policies: allow authenticated users to read profiles and roles (could be limited per company if needed)
create policy if not exists profiles_read on public.profiles
  for select using (auth.uid() is not null);

create policy if not exists user_roles_read on public.user_roles
  for select using (auth.uid() is not null);

-- Insert profiles: only service role (via function) or admins/managers can insert
create policy if not exists profiles_manage on public.profiles
  for insert with check (
    public.has_role('admin', auth.uid())
    or public.has_role('manager', auth.uid())
  );

-- Update profiles (e.g., disabled flag): admins/managers
create policy if not exists profiles_update on public.profiles
  for update using (
    public.has_role('admin', auth.uid())
    or public.has_role('manager', auth.uid())
  ) with check (
    public.has_role('admin', auth.uid())
    or public.has_role('manager', auth.uid())
  );

-- Delete profiles: admin only
create policy if not exists profiles_delete on public.profiles
  for delete using (public.has_role('admin', auth.uid()));

-- Insert user_roles: admin; manager cannot assign admin
create policy if not exists user_roles_insert on public.user_roles
  for insert with check (
    public.has_role('admin', auth.uid())
    or (
      public.has_role('manager', auth.uid())
      and (new.role != 'admin')
    )
  );

-- Update user_roles: admin; manager cannot set admin
create policy if not exists user_roles_update on public.user_roles
  for update using (
    public.has_role('admin', auth.uid())
    or public.has_role('manager', auth.uid())
  ) with check (
    public.has_role('admin', auth.uid())
    or (public.has_role('manager', auth.uid()) and (new.role != 'admin'))
  );

-- Delete user_roles: admin; manager cannot delete admin
create policy if not exists user_roles_delete on public.user_roles
  for delete using (
    public.has_role('admin', auth.uid())
    or (public.has_role('manager', auth.uid()) and (old.role != 'admin'))
  );
