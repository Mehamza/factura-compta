-- Refactor company_plans to be per-company and add RPC for effective permissions.

begin;

-- Ensure table exists
create table if not exists public.company_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  active boolean not null default true,
  assigned_at timestamptz not null default now(),
  unique (company_id)
);

-- If table existed previously without new columns, add them
alter table public.company_plans add column if not exists company_id uuid;
alter table public.company_plans add column if not exists plan_id uuid;
alter table public.company_plans add column if not exists active boolean default true;
alter table public.company_plans add column if not exists assigned_at timestamptz default now();
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'company_plans_company_fk' and conrelid = 'public.company_plans'::regclass
  ) then
    alter table public.company_plans add constraint company_plans_company_fk foreign key (company_id) references public.companies(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'company_plans_plan_fk' and conrelid = 'public.company_plans'::regclass
  ) then
    alter table public.company_plans add constraint company_plans_plan_fk foreign key (plan_id) references public.plans(id) on delete restrict;
  end if;
end $$;

alter table public.company_plans enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='company_plans' and policyname='company_plans_super_admin_all') then
    create policy company_plans_super_admin_all on public.company_plans for all using (public.has_global_role('SUPER_ADMIN', auth.uid())) with check (public.has_global_role('SUPER_ADMIN', auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='company_plans' and policyname='company_plans_company_members_read') then
    create policy company_plans_company_members_read on public.company_plans for select using (
      public.has_global_role('SUPER_ADMIN', auth.uid())
      or exists (select 1 from public.user_company_roles ucr where ucr.user_id = auth.uid() and ucr.company_id = company_plans.company_id)
    );
  end if;
end $$;

-- RPC: get_effective_permissions for a company
-- Ensure old signature is dropped to avoid parameter rename error
drop function if exists public.get_effective_permissions(uuid);
create or replace function public.get_effective_permissions(p_company_id uuid)
returns jsonb language plpgsql stable as $$
declare
  v_plan_id uuid;
  v_features jsonb := '{}'::jsonb;
begin
  select cp.plan_id into v_plan_id from public.company_plans cp where cp.company_id = p_company_id and cp.active = true limit 1;
  if v_plan_id is null then
    return '{}'::jsonb;
  end if;
  select pf.features into v_features from public.plan_features pf where pf.plan_id = v_plan_id limit 1;
  return coalesce(v_features, '{}'::jsonb);
end; $$;

commit;
