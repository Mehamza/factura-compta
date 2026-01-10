-- Warehouses + per-warehouse stock + transactional stock movements

begin;

-- 1) Warehouses (entrepots)
create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  address text,
  city text,
  country text,
  manager_name text,
  manager_phone text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Unique code per company (ignore soft-deleted)
create unique index if not exists warehouses_company_code_uq
  on public.warehouses (company_id, lower(code))
  where deleted_at is null;

-- Only one default warehouse per company (ignore soft-deleted)
create unique index if not exists warehouses_one_default_per_company_uq
  on public.warehouses (company_id)
  where is_default is true and deleted_at is null;

create index if not exists warehouses_company_active_idx
  on public.warehouses (company_id, is_active)
  where deleted_at is null;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'update_warehouses_updated_at'
  ) then
    create trigger update_warehouses_updated_at
      before update on public.warehouses
      for each row
      execute function public.update_updated_at_column();
  end if;
end $$;

-- Prevent deleting (soft-delete) the default warehouse
create or replace function public.prevent_delete_default_warehouse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null and (old.deleted_at is null) and old.is_default is true then
    raise exception 'Cannot delete default warehouse';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'prevent_delete_default_warehouse_trg'
  ) then
    create trigger prevent_delete_default_warehouse_trg
      before update of deleted_at on public.warehouses
      for each row
      execute function public.prevent_delete_default_warehouse();
  end if;
end $$;

-- 2) Per-warehouse product stock
create table if not exists public.warehouse_products (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric not null default 0,
  min_quantity numeric not null default 0,
  max_quantity numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouse_products_qty_nonneg check (quantity >= 0),
  constraint warehouse_products_min_nonneg check (min_quantity >= 0),
  constraint warehouse_products_max_nonneg check (max_quantity is null or max_quantity >= 0),
  constraint warehouse_products_min_le_max check (max_quantity is null or min_quantity <= max_quantity)
);

create unique index if not exists warehouse_products_wh_product_uq
  on public.warehouse_products (warehouse_id, product_id);

create index if not exists warehouse_products_product_idx
  on public.warehouse_products (product_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'update_warehouse_products_updated_at'
  ) then
    create trigger update_warehouse_products_updated_at
      before update on public.warehouse_products
      for each row
      execute function public.update_updated_at_column();
  end if;
end $$;

-- 3) Extend existing stock_movements to support warehouse + transfers + references
alter table public.stock_movements
  add column if not exists warehouse_id uuid references public.warehouses(id) on delete set null;

alter table public.stock_movements
  add column if not exists source_warehouse_id uuid references public.warehouses(id) on delete set null;

alter table public.stock_movements
  add column if not exists destination_warehouse_id uuid references public.warehouses(id) on delete set null;

alter table public.stock_movements
  add column if not exists reference_type text;

alter table public.stock_movements
  add column if not exists reference_id uuid;

create index if not exists stock_movements_company_created_idx
  on public.stock_movements (company_id, created_at desc);

create index if not exists stock_movements_wh_product_idx
  on public.stock_movements (warehouse_id, product_id, created_at desc);

create index if not exists stock_movements_src_dest_idx
  on public.stock_movements (source_warehouse_id, destination_warehouse_id, created_at desc);

-- 4) Helper: get default warehouse for a company
create or replace function public.get_default_warehouse_id(p_company_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.warehouses
  where company_id = p_company_id
    and deleted_at is null
    and is_active is true
  order by is_default desc, created_at asc
  limit 1;
$$;

-- 5) Transactional stock movement application
-- Updates warehouse_products AND keeps products.quantity in sync (total stock).
create or replace function public.apply_warehouse_stock_movement(
  p_company_id uuid,
  p_user_id uuid,
  p_kind text, -- 'IN' | 'OUT' | 'TRANSFER'
  p_product_id uuid,
  p_quantity numeric,
  p_warehouse_id uuid default null,
  p_source_warehouse_id uuid default null,
  p_destination_warehouse_id uuid default null,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_qty numeric;
  v_product_company uuid;
  v_movement_id uuid;
  v_current numeric;
  v_product_total numeric;
begin
  v_kind := upper(coalesce(p_kind, ''));
  v_qty := coalesce(p_quantity, 0);

  if v_kind not in ('IN', 'OUT', 'TRANSFER') then
    raise exception 'Invalid movement kind';
  end if;

  if v_qty <= 0 then
    raise exception 'Quantity must be > 0';
  end if;

  select company_id, quantity into v_product_company, v_product_total
  from public.products
  where id = p_product_id
  for update;

  if v_product_company is null then
    raise exception 'Product not found';
  end if;

  if v_product_company <> p_company_id then
    raise exception 'Product does not belong to company';
  end if;

  if v_kind in ('IN','OUT') then
    if p_warehouse_id is null then
      raise exception 'warehouse_id required';
    end if;

    -- ensure warehouse belongs to company and is not deleted
    perform 1
    from public.warehouses w
    where w.id = p_warehouse_id
      and w.company_id = p_company_id
      and w.deleted_at is null;

    if not found then
      raise exception 'Warehouse not found';
    end if;

    if v_kind = 'IN' then
      insert into public.warehouse_products (warehouse_id, product_id, quantity)
      values (p_warehouse_id, p_product_id, v_qty)
      on conflict (warehouse_id, product_id)
      do update set quantity = public.warehouse_products.quantity + excluded.quantity,
                    updated_at = now();

      update public.products
        set quantity = coalesce(quantity, 0) + v_qty
      where id = p_product_id;

      insert into public.stock_movements (
        user_id, company_id, product_id, movement_type, quantity, note,
        warehouse_id, reference_type, reference_id
      ) values (
        p_user_id, p_company_id, p_product_id, 'entry', v_qty, p_note,
        p_warehouse_id, p_reference_type, p_reference_id
      ) returning id into v_movement_id;

      return v_movement_id;
    end if;

    -- OUT
    select quantity into v_current
    from public.warehouse_products
    where warehouse_id = p_warehouse_id and product_id = p_product_id
    for update;

    if v_current is null or v_current < v_qty then
      raise exception 'Insufficient warehouse stock';
    end if;

    if coalesce(v_product_total, 0) < v_qty then
      raise exception 'Insufficient total stock';
    end if;

    update public.warehouse_products
      set quantity = quantity - v_qty,
          updated_at = now()
    where warehouse_id = p_warehouse_id and product_id = p_product_id;

    update public.products
      set quantity = greatest(0, coalesce(quantity, 0) - v_qty)
    where id = p_product_id;

    insert into public.stock_movements (
      user_id, company_id, product_id, movement_type, quantity, note,
      warehouse_id, reference_type, reference_id
    ) values (
      p_user_id, p_company_id, p_product_id, 'exit', v_qty, p_note,
      p_warehouse_id, p_reference_type, p_reference_id
    ) returning id into v_movement_id;

    return v_movement_id;
  end if;

  -- TRANSFER
  if p_source_warehouse_id is null or p_destination_warehouse_id is null then
    raise exception 'source_warehouse_id and destination_warehouse_id required for transfer';
  end if;

  if p_source_warehouse_id = p_destination_warehouse_id then
    raise exception 'Source and destination warehouses must differ';
  end if;

  perform 1
  from public.warehouses w
  where w.id = p_source_warehouse_id
    and w.company_id = p_company_id
    and w.deleted_at is null;
  if not found then
    raise exception 'Source warehouse not found';
  end if;

  perform 1
  from public.warehouses w
  where w.id = p_destination_warehouse_id
    and w.company_id = p_company_id
    and w.deleted_at is null;
  if not found then
    raise exception 'Destination warehouse not found';
  end if;

  select quantity into v_current
  from public.warehouse_products
  where warehouse_id = p_source_warehouse_id and product_id = p_product_id
  for update;

  if v_current is null or v_current < v_qty then
    raise exception 'Insufficient warehouse stock';
  end if;

  -- decrement source
  update public.warehouse_products
    set quantity = quantity - v_qty,
        updated_at = now()
  where warehouse_id = p_source_warehouse_id and product_id = p_product_id;

  -- increment destination
  insert into public.warehouse_products (warehouse_id, product_id, quantity)
  values (p_destination_warehouse_id, p_product_id, v_qty)
  on conflict (warehouse_id, product_id)
  do update set quantity = public.warehouse_products.quantity + excluded.quantity,
                updated_at = now();

  insert into public.stock_movements (
    user_id, company_id, product_id, movement_type, quantity, note,
    source_warehouse_id, destination_warehouse_id, reference_type, reference_id
  ) values (
    p_user_id, p_company_id, p_product_id, 'transfer', v_qty, p_note,
    p_source_warehouse_id, p_destination_warehouse_id, p_reference_type, p_reference_id
  ) returning id into v_movement_id;

  return v_movement_id;
end;
$$;

commit;
