-- Plans & Tarification schema

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_year numeric not null default 0,
  duration text not null default 'annuel',
  active boolean not null default true,
  display_order int not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  key text not null,
  value jsonb not null,
  created_at timestamp with time zone default now()
);

-- Company subscription to a plan
create table if not exists public.company_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan_id uuid not null references public.plans(id) on delete restrict,
  started_at timestamp with time zone default now(),
  expires_at timestamp with time zone,
  active boolean not null default true
);

create index if not exists idx_company_plans_user on public.company_plans(user_id);
create index if not exists idx_plan_features_plan on public.plan_features(plan_id);

-- Seed default plans
insert into public.plans (name, description, price_year, duration, active, display_order)
values
  ('Essai', 'Essai gratuit 15 jours', 0, 'annuel', true, 1),
  ('Accès limité', 'Fonctionnalités de base pour démarrer', 99, 'annuel', true, 2),
  ('PME Standard', 'Fonctionnalités essentielles pour PME', 299, 'annuel', true, 3),
  ('PME Pro', 'Fonctionnalités avancées et support prioritaire', 599, 'annuel', true, 4)
on conflict do nothing;

-- Feature keys (examples):
-- billing.max_invoices_per_day: {"value": 20}
-- billing.invoices_unlimited: {"enabled": false}
-- billing.invoice_edit: {"enabled": true}
-- billing.pdf_watermark: {"enabled": false}
-- users.max_users: {"value": 3}
-- users.roles_enabled: {"list": ["admin","user","comptable","gerant","caissier"]}
-- stock.readonly: {"enabled": false}
-- stock.manage_products: {"enabled": true}
-- stock.stock_alerts: {"enabled": true}
-- export.csv: {"enabled": true}
-- reports.access: {"enabled": true}
-- accounting.access: {"enabled": false}

-- Helper function to compute effective permissions for a user
create or replace function public.get_effective_permissions(p_user_id uuid)
returns jsonb as $$
declare
  v_plan_id uuid;
  v_features jsonb := '{}'::jsonb;
begin
  select plan_id into v_plan_id from public.company_plans where user_id = p_user_id and active = true order by started_at desc limit 1;
  if v_plan_id is null then
    return '{}'::jsonb; -- no plan
  end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_features from public.plan_features where plan_id = v_plan_id;
  return v_features;
end; $$ language plpgsql security definer;
