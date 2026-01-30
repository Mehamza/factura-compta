-- Company Trial (15 days) + Paid Access + Restriction scaffolding

begin;

-- One row per company controlling trial + subscription access.
create table if not exists public.company_access (
  company_id uuid primary key references public.companies(id) on delete cascade,
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '15 days'),
  is_paid boolean not null default false,
  paid_until timestamptz,
  lifetime boolean not null default false,
  -- When company is restricted (trial ended and unpaid), this allow-list is enforced client-side.
  unpaid_permissions jsonb not null default '{"allow":["dashboard"]}'::jsonb,
  restricted boolean not null default false,
  last_computed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_access enable row level security;

-- RLS
-- Super Admin: full access
DO $$ BEGIN
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='company_access' and policyname='company_access_super_admin_all'
  ) then
    create policy company_access_super_admin_all
      on public.company_access
      for all
      using (public.has_global_role('SUPER_ADMIN', auth.uid()))
      with check (public.has_global_role('SUPER_ADMIN', auth.uid()));
  end if;
END $$;

-- Company members: can read access state for their company (banner + gating)
DO $$ BEGIN
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='company_access' and policyname='company_access_company_members_read'
  ) then
    create policy company_access_company_members_read
      on public.company_access
      for select
      using (
        public.has_global_role('SUPER_ADMIN', auth.uid())
        or exists (
          select 1 from public.company_users cu
          where cu.user_id = auth.uid() and cu.company_id = company_access.company_id
        )
        or exists (
          select 1 from public.user_company_roles ucr
          where ucr.user_id = auth.uid() and ucr.company_id = company_access.company_id
        )
      );
  end if;
END $$;

-- updated_at trigger
DO $$ BEGIN
  if exists (select 1 from pg_proc where proname='update_updated_at_column') then
    drop trigger if exists update_company_access_updated_at on public.company_access;
    create trigger update_company_access_updated_at
      before update on public.company_access
      for each row execute function public.update_updated_at_column();
  end if;
END $$;

-- Ensure a row exists for a given company.
create or replace function public.ensure_company_access(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.company_access (company_id)
  values (p_company_id)
  on conflict (company_id) do nothing;
end;
$$;

-- Initialize company_access when a company is created.
create or replace function public.trg_init_company_access()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.ensure_company_access(new.id);
  return new;
end;
$$;

drop trigger if exists trg_init_company_access on public.companies;
create trigger trg_init_company_access
after insert on public.companies
for each row execute function public.trg_init_company_access();

-- Compute and persist restricted flag for a single company.
create or replace function public.compute_company_access(p_company_id uuid)
returns table(
  company_id uuid,
  restricted boolean,
  in_trial boolean,
  trial_days_left integer,
  paid_active boolean,
  trial_ends_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_trial_ends timestamptz;
  v_is_paid boolean;
  v_paid_until timestamptz;
  v_lifetime boolean;
  v_paid_active boolean;
  v_restricted boolean;
  v_in_trial boolean;
  v_days_left integer;
  v_seconds_left numeric;
begin
  perform public.ensure_company_access(p_company_id);

  select ca.trial_ends_at, ca.is_paid, ca.paid_until, ca.lifetime
    into v_trial_ends, v_is_paid, v_paid_until, v_lifetime
  from public.company_access ca
  where ca.company_id = p_company_id;

  v_paid_active := (v_is_paid = true) and (v_lifetime = true or (v_paid_until is not null and v_paid_until > now()));
  v_in_trial := (not v_paid_active) and (now() < v_trial_ends);
  v_restricted := (not v_paid_active) and (now() >= v_trial_ends);

  v_seconds_left := extract(epoch from (v_trial_ends - now()));
  if v_seconds_left <= 0 then
    v_days_left := 0;
  else
    v_days_left := ceil(v_seconds_left / 86400.0);
  end if;

  update public.company_access
     set restricted = v_restricted,
         last_computed_at = now()
   where company_id = p_company_id;

  return query select p_company_id, v_restricted, v_in_trial, v_days_left, v_paid_active, v_trial_ends;
end;
$$;

-- Batch recompute (for cron/scheduler).
create or replace function public.enforce_company_access()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count integer := 0;
  r record;
begin
  -- Require SUPER_ADMIN when called with user JWT (service_role bypasses RLS anyway).
  if auth.uid() is not null and not public.has_global_role('SUPER_ADMIN', auth.uid()) then
    raise exception 'not authorized';
  end if;

  for r in select id from public.companies loop
    perform public.compute_company_access(r.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

commit;
