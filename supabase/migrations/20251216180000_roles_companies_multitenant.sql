-- Multi-tenant foundations: companies + per-company roles
-- and helper functions to distinguish SUPER_ADMIN (global)
-- vs COMPANY_ADMIN (per-company).

begin;

-- Companies table
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-company roles for users
-- role stored as text for flexibility; optionally convert to enum later
create table if not exists public.user_company_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  unique (user_id, company_id, role)
);

-- Enable RLS
alter table public.companies enable row level security;
alter table public.user_company_roles enable row level security;

-- Helper functions
-- Global role check: SUPER_ADMIN lives in public.user_roles as a global role
create or replace function public.has_global_role(p_role text, p_user_id uuid)
returns boolean language sql stable as $fn$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_user_id and lower(ur.role::text) = lower(p_role)
  );
$fn$;

-- Company role check: membership in user_company_roles scoped to company
create or replace function public.has_company_role(p_role text, p_user_id uuid, p_company_id uuid)
returns boolean language sql stable as $fn$
  select exists (
    select 1 from public.user_company_roles ucr
    where ucr.user_id = p_user_id and ucr.company_id = p_company_id and lower(ucr.role) = lower(p_role)
  );
$fn$;

-- Basic RLS: SUPER_ADMIN can see/manage all; users see their memberships
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='companies' and policyname='companies_super_admin_all'
  ) then
    create policy companies_super_admin_all on public.companies
      for all using (public.has_global_role('SUPER_ADMIN', auth.uid()))
      with check (public.has_global_role('SUPER_ADMIN', auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='companies' and policyname='companies_members_read'
  ) then
    create policy companies_members_read on public.companies
      for select using (
        public.has_global_role('SUPER_ADMIN', auth.uid())
        or exists (
          select 1 from public.user_company_roles ucr
          where ucr.user_id = auth.uid() and ucr.company_id = companies.id
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_company_roles' and policyname='ucr_super_admin_all'
  ) then
    create policy ucr_super_admin_all on public.user_company_roles
      for all using (public.has_global_role('SUPER_ADMIN', auth.uid()))
      with check (public.has_global_role('SUPER_ADMIN', auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_company_roles' and policyname='ucr_company_admin_manage'
  ) then
    create policy ucr_company_admin_manage on public.user_company_roles
      for insert with check (
        public.has_company_role('COMPANY_ADMIN', auth.uid(), user_company_roles.company_id)
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_company_roles' and policyname='ucr_company_admin_update'
  ) then
    create policy ucr_company_admin_update on public.user_company_roles
      for update using (
        public.has_company_role('COMPANY_ADMIN', auth.uid(), user_company_roles.company_id)
      ) with check (
        public.has_company_role('COMPANY_ADMIN', auth.uid(), user_company_roles.company_id)
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_company_roles' and policyname='ucr_company_admin_delete'
  ) then
    create policy ucr_company_admin_delete on public.user_company_roles
      for delete using (
        public.has_company_role('COMPANY_ADMIN', auth.uid(), user_company_roles.company_id)
      );
  end if;
end $$;

commit;
