-- Global roles table (SUPER_ADMIN) for production multi-tenant RBAC
-- Adds `user_global_roles` and updates `has_global_role` to use it.

begin;

create table if not exists public.user_global_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_global_roles enable row level security;

-- Replace global role check to use user_global_roles (not legacy user_roles enum)
create or replace function public.has_global_role(p_role text, p_user_id uuid)
returns boolean language sql stable as $fn$
  select exists (
    select 1
    from public.user_global_roles ugr
    where ugr.user_id = p_user_id and lower(ugr.role) = lower(p_role)
  );
$fn$;

-- RLS policies (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_global_roles' AND policyname='ugr_select_own'
  ) THEN
    CREATE POLICY ugr_select_own ON public.user_global_roles
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_global_roles' AND policyname='ugr_super_admin_manage'
  ) THEN
    CREATE POLICY ugr_super_admin_manage ON public.user_global_roles
      FOR ALL
      USING (public.has_global_role('SUPER_ADMIN', auth.uid()))
      WITH CHECK (public.has_global_role('SUPER_ADMIN', auth.uid()));
  END IF;
END $$;

-- One-time migration: legacy app_role admin -> SUPER_ADMIN
insert into public.user_global_roles (user_id, role)
select ur.user_id, 'SUPER_ADMIN'
from public.user_roles ur
where ur.role::text = 'admin'
on conflict do nothing;

commit;
