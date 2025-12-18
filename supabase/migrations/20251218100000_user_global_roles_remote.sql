-- Remote-safe migration: introduce global roles table used by the app for SUPER_ADMIN
-- This migration is intentionally independent from multi-tenant/company migrations.

begin;

create table if not exists public.user_global_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_global_roles enable row level security;

-- Policies (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_global_roles' AND policyname='ugr_select_own'
  ) THEN
    CREATE POLICY ugr_select_own ON public.user_global_roles
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Allow SUPER_ADMIN to manage global roles (uses legacy admin role if user_global_roles is empty)
-- If has_global_role exists, keep it in sync; otherwise create it.
create or replace function public.has_global_role(p_role text, p_user_id uuid)
returns boolean language sql stable as $fn$
  select (
    exists (
      select 1 from public.user_global_roles ugr
      where ugr.user_id = p_user_id and lower(ugr.role) = lower(p_role)
    )
    or (
      lower(p_role) = 'super_admin'
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = p_user_id and ur.role::text = 'admin'
      )
    )
  );
$fn$;

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

-- One-time backfill: legacy app_role admin -> SUPER_ADMIN
insert into public.user_global_roles (user_id, role)
select ur.user_id, 'SUPER_ADMIN'
from public.user_roles ur
where ur.role::text = 'admin'
on conflict do nothing;

commit;
