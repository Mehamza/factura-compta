-- Extend products table with richer fields for UI form
-- Safe-guard with IF NOT EXISTS to be idempotent

alter table if exists public.products
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists purchase_price numeric default 0 not null,
  add column if not exists sale_price numeric default 0 not null,
  add column if not exists initial_qty numeric default 0 not null,
  add column if not exists unit text default 'pièce' not null,
  add column if not exists vat_rate numeric default 0 not null,
  add column if not exists supplier text;

-- Backward-compatibility: mirror unit_price with sale_price if unit_price exists
update public.products set sale_price = coalesce(sale_price, unit_price) where sale_price is distinct from unit_price;
update public.products set unit_price = coalesce(unit_price, sale_price) where unit_price is null;

-- Constraints & indexes
do $$ begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'products_sku_unique'
  ) then
    create unique index products_sku_unique on public.products (lower(sku)) where sku is not null;
  end if;
end $$;

alter table public.products
  alter column purchase_price set not null,
  alter column sale_price set not null,
  alter column initial_qty set not null,
  alter column unit set not null,
  alter column vat_rate set not null;

-- Numeric sanity checks
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_price_non_negative'
  ) then
    alter table public.products add constraint products_price_non_negative check (
      purchase_price >= 0 and sale_price >= 0 and unit_price >= 0 and min_stock >= 0 and quantity >= 0 and initial_qty >= 0
    );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_vat_rate_range'
  ) then
    alter table public.products add constraint products_vat_rate_range check (vat_rate >= 0 and vat_rate <= 100);
  end if;
end $$;
