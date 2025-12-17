-- Add company_id to core domain tables and basic constraints.

begin;

-- Ensure a default company exists for backfill
insert into public.companies (id, name, active)
select gen_random_uuid(), 'Default Company', true
where not exists (select 1 from public.companies);

-- Helper to fetch any existing company id
create or replace function public._get_default_company_id()
returns uuid language sql stable as $$
  select id from public.companies order by created_at limit 1
$$;

-- Clients
alter table if exists public.clients add column if not exists company_id uuid;
update public.clients set company_id = public._get_default_company_id() where company_id is null;
alter table public.clients alter column company_id set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_company_fk' and conrelid = 'public.clients'::regclass
  ) then
    alter table public.clients add constraint clients_company_fk foreign key (company_id) references public.companies(id) on delete restrict;
  end if;
end $$;

-- Suppliers
alter table if exists public.suppliers add column if not exists company_id uuid;
update public.suppliers set company_id = public._get_default_company_id() where company_id is null;
alter table public.suppliers alter column company_id set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'suppliers_company_fk' and conrelid = 'public.suppliers'::regclass
  ) then
    alter table public.suppliers add constraint suppliers_company_fk foreign key (company_id) references public.companies(id) on delete restrict;
  end if;
end $$;

-- Products
alter table if exists public.products add column if not exists company_id uuid;
update public.products set company_id = public._get_default_company_id() where company_id is null;
alter table public.products alter column company_id set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_company_fk' and conrelid = 'public.products'::regclass
  ) then
    alter table public.products add constraint products_company_fk foreign key (company_id) references public.companies(id) on delete restrict;
  end if;
end $$;

-- Invoices
alter table if exists public.invoices add column if not exists company_id uuid;
update public.invoices set company_id = public._get_default_company_id() where company_id is null;
alter table public.invoices alter column company_id set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'invoices_company_fk' and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices add constraint invoices_company_fk foreign key (company_id) references public.companies(id) on delete restrict;
  end if;
end $$;

-- Invoice items
alter table if exists public.invoice_items add column if not exists company_id uuid;
update public.invoice_items set company_id = i.company_id from public.invoices i where public.invoice_items.invoice_id = i.id and public.invoice_items.company_id is null;
update public.invoice_items set company_id = public._get_default_company_id() where company_id is null;
alter table public.invoice_items alter column company_id set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'invoice_items_company_fk' and conrelid = 'public.invoice_items'::regclass
  ) then
    alter table public.invoice_items add constraint invoice_items_company_fk foreign key (company_id) references public.companies(id) on delete restrict;
  end if;
end $$;

commit;
