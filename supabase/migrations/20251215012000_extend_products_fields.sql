-- Extend products table with PME-required fields (no image)

alter table public.products
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists purchase_price numeric,
  add column if not exists sale_price numeric,
  add column if not exists initial_qty numeric,
  add column if not exists min_stock numeric,
  add column if not exists unit text,
  add column if not exists vat_rate numeric,
  add column if not exists supplier text,
  add column if not exists currency text;

-- Enforce SKU uniqueness
create unique index if not exists products_sku_unique_idx
  on public.products (lower(sku));

-- Basic check constraints for non-negative numeric fields
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_non_negative_chk'
      and conrelid = 'public.products'::regclass
  ) then
    execute '
      alter table public.products
        add constraint products_non_negative_chk
        check (
          coalesce(purchase_price, 0) >= 0 and
          coalesce(sale_price, 0) >= 0 and
          coalesce(initial_qty, 0) >= 0 and
          coalesce(min_stock, 0) >= 0 and
          coalesce(vat_rate, 0) >= 0
        );
    ';
  end if;
end
$$;
