-- Policies for profiles and user_roles enforcing role-based CRUD

-- Ensure RLS is enabled
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- Define helper function (idempotent via create or replace)
create or replace function public.has_role(role text, user_id uuid)
returns boolean language sql stable as $fn$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = user_id and lower(ur.role) = lower(role)
  );
$fn$;

-- Read policies: allow authenticated users to read profiles and roles
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_read') then
    create policy profiles_read on public.profiles for select using (auth.uid() is not null);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_roles' and policyname = 'user_roles_read') then
    create policy user_roles_read on public.user_roles for select using (auth.uid() is not null);
  end if;
end $$;

-- Insert profiles: only service role (via function) or admins/managers can insert
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_manage') then
    create policy profiles_manage on public.profiles for insert with check (
      public.has_role('admin', auth.uid())
      or public.has_role('manager', auth.uid())
    );
  end if;
end $$;

-- Update profiles (e.g., disabled flag): admins/managers
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update') then
    create policy profiles_update on public.profiles for update using (
      public.has_role('admin', auth.uid())
      or public.has_role('manager', auth.uid())
    ) with check (
      public.has_role('admin', auth.uid())
      or public.has_role('manager', auth.uid())
    );
  end if;
end $$;

-- Delete profiles: admin only
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_delete') then
    create policy profiles_delete on public.profiles for delete using (public.has_role('admin', auth.uid()));
  end if;
end $$;

-- Insert user_roles: admin; manager cannot assign admin
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_roles' and policyname = 'user_roles_insert') then
    create policy user_roles_insert on public.user_roles for insert with check (
      public.has_role('admin', auth.uid())
      or (
        public.has_role('manager', auth.uid())
        and (new.role != 'admin')
      )
    );
  end if;
end $$;

-- Update user_roles: admin; manager cannot set admin
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_roles' and policyname = 'user_roles_update') then
    create policy user_roles_update on public.user_roles for update using (
      public.has_role('admin', auth.uid())
      or public.has_role('manager', auth.uid())
    ) with check (
      public.has_role('admin', auth.uid())
      or (public.has_role('manager', auth.uid()) and (new.role != 'admin'))
    );
  end if;
end $$;

-- Delete user_roles: admin; manager cannot delete admin
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_roles' and policyname = 'user_roles_delete') then
    create policy user_roles_delete on public.user_roles for delete using (
      public.has_role('admin', auth.uid())
      or (public.has_role('manager', auth.uid()) and (old.role != 'admin'))
    );
  end if;
end $$;
