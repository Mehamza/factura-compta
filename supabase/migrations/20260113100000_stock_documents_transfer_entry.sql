-- Stock internal documents: Bon de transfert + Bon d’entrée
-- Adds atomic RPCs that create a document with multiple lines and apply warehouse stock movements transactionally.

begin;

-- =========================
-- 1) TABLES
-- =========================

create table if not exists public.stock_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  document_type text not null check (document_type in ('transfer','entry')),
  document_number text not null,
  note text,

  -- Transfer
  source_warehouse_id uuid references public.warehouses(id) on delete set null,
  destination_warehouse_id uuid references public.warehouses(id) on delete set null,

  -- Entry
  warehouse_id uuid references public.warehouses(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stock_documents_transfer_wh_required check (
    document_type <> 'transfer'
    or (
      source_warehouse_id is not null
      and destination_warehouse_id is not null
      and source_warehouse_id <> destination_warehouse_id
    )
  ),
  constraint stock_documents_entry_wh_required check (
    document_type <> 'entry'
    or warehouse_id is not null
  )
);

create unique index if not exists stock_documents_company_number_uq
  on public.stock_documents (company_id, document_number);

create index if not exists stock_documents_company_created_idx
  on public.stock_documents (company_id, created_at desc);

create table if not exists public.stock_document_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.stock_documents(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric not null,

  apply_pricing_updates boolean not null default false,
  new_sale_price numeric,
  new_vat_rate numeric,

  created_at timestamptz not null default now(),

  constraint stock_document_items_qty_pos check (quantity > 0),
  constraint stock_document_items_prices_nonneg check (
    (new_sale_price is null or new_sale_price >= 0)
    and (new_vat_rate is null or new_vat_rate >= 0)
  )
);

create index if not exists stock_document_items_doc_idx
  on public.stock_document_items (document_id);

create index if not exists stock_document_items_product_idx
  on public.stock_document_items (product_id);

create table if not exists public.product_pricing_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  document_id uuid references public.stock_documents(id) on delete set null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  old_sale_price numeric,
  new_sale_price numeric,
  old_vat_rate numeric,
  new_vat_rate numeric
);

create index if not exists product_pricing_history_company_product_idx
  on public.product_pricing_history (company_id, product_id, changed_at desc);

-- =========================
-- updated_at trigger
-- =========================

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'update_stock_documents_updated_at'
  ) then
    create trigger update_stock_documents_updated_at
      before update on public.stock_documents
      for each row
      execute function public.update_updated_at_column();
  end if;
end $$;

-- =========================
-- 2) RLS
-- =========================

alter table public.stock_documents enable row level security;
alter table public.stock_document_items enable row level security;
alter table public.product_pricing_history enable row level security;

-- ---- SELECT POLICIES ----

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'stock_documents'
      and policyname = 'stock_documents_select_company_members'
  ) then
    create policy stock_documents_select_company_members
      on public.stock_documents
      for select
      using (
        exists (
          select 1
          from public.company_users cu
          where cu.company_id = stock_documents.company_id
            and cu.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'stock_document_items'
      and policyname = 'stock_document_items_select_company_members'
  ) then
    create policy stock_document_items_select_company_members
      on public.stock_document_items
      for select
      using (
        exists (
          select 1
          from public.stock_documents d
          join public.company_users cu
            on cu.company_id = d.company_id
           and cu.user_id = auth.uid()
          where d.id = stock_document_items.document_id
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'product_pricing_history'
      and policyname = 'product_pricing_history_select_company_members'
  ) then
    create policy product_pricing_history_select_company_members
      on public.product_pricing_history
      for select
      using (
        exists (
          select 1
          from public.company_users cu
          where cu.company_id = product_pricing_history.company_id
            and cu.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- ---- INSERT POLICIES ----

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'stock_documents'
      and policyname = 'stock_documents_insert_privileged'
  ) then
    create policy stock_documents_insert_privileged
      on public.stock_documents
      for insert
      with check (
        exists (
          select 1
          from public.company_users cu
          where cu.company_id = stock_documents.company_id
            and cu.user_id = auth.uid()
            and cu.role::text in ('admin','manager','accountant','company_admin','gerant','comptable')
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'stock_document_items'
      and policyname = 'stock_document_items_insert_privileged'
  ) then
    create policy stock_document_items_insert_privileged
      on public.stock_document_items
      for insert
      with check (
        exists (
          select 1
          from public.stock_documents d
          join public.company_users cu
            on cu.company_id = d.company_id
           and cu.user_id = auth.uid()
           and cu.role::text in ('admin','manager','accountant','company_admin','gerant','comptable')
          where d.id = stock_document_items.document_id
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'product_pricing_history'
      and policyname = 'product_pricing_history_insert_privileged'
  ) then
    create policy product_pricing_history_insert_privileged
      on public.product_pricing_history
      for insert
      with check (
        exists (
          select 1
          from public.company_users cu
          where cu.company_id = product_pricing_history.company_id
            and cu.user_id = auth.uid()
            and cu.role::text in ('admin','manager','accountant','company_admin','gerant','comptable')
        )
      );
  end if;
end $$;

-- =========================
-- 3) SEQUENCE + FUNCTIONS
-- =========================

create sequence if not exists public.stock_documents_number_seq;

create or replace function public.next_stock_document_number(p_prefix text)
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select upper(coalesce(p_prefix,'')) || '-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.stock_documents_number_seq')::text, 5, '0');
$$;

-- Ensures a default warehouse exists and returns its id.
create or replace function public.ensure_default_warehouse_id(p_company_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    if current_user not in ('postgres','service_role','supabase_admin')
       and session_user not in ('postgres','service_role','supabase_admin') then
      raise exception 'Not authenticated';
    end if;
  end if;

  if auth.uid() is not null then
    if not exists (
      select 1
      from public.company_users cu
      where cu.company_id = p_company_id
        and cu.user_id = auth.uid()
        and cu.role::text in ('admin','manager','accountant','company_admin','gerant','comptable')
    ) then
      raise exception 'Forbidden';
    end if;
  end if;

  select id into v_id
  from public.warehouses
  where company_id = p_company_id
    and deleted_at is null
    and is_active is true
  order by is_default desc, created_at asc
  limit 1;

  if v_id is null then
    insert into public.warehouses (company_id, code, name, is_default, is_active)
    values (p_company_id, 'DEPOT', 'Dépôt principal', true, true)
    returning id into v_id;
    return v_id;
  end if;

  -- normalize default flag
  update public.warehouses
    set is_default = false
  where company_id = p_company_id
    and deleted_at is null
    and id <> v_id
    and is_default is true;

  update public.warehouses
    set is_default = true
  where id = v_id;

  return v_id;
end;
$$;

-- These RPCs may already exist with the same argument types but different parameter names.
-- Drop first to keep the migration replayable (e.g. for `supabase db pull` shadow DB).
drop function if exists public.create_stock_entry_document(uuid, uuid, jsonb, text, uuid);
drop function if exists public.create_stock_transfer_document(uuid, uuid, uuid, jsonb, text, uuid);

create or replace function public.create_stock_transfer_document(
  p_company_id uuid,
  p_source_warehouse_id uuid,
  p_destination_warehouse_id uuid,
  p_items jsonb,
  p_note text default null,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_doc_id uuid;
  v_doc_number text;
  v_item jsonb;
  v_product_id uuid;
  v_qty numeric;
  v_can boolean;
begin
  if auth.uid() is null then
    if current_user not in ('postgres','service_role','supabase_admin')
       and session_user not in ('postgres','service_role','supabase_admin') then
      raise exception 'Not authenticated';
    end if;
    if p_created_by is null then
      raise exception 'created_by required';
    end if;
  end if;

  v_user_id := coalesce(auth.uid(), p_created_by);
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select exists(
    select 1
    from public.company_users cu
    where cu.company_id = p_company_id
      and cu.user_id = v_user_id
      and cu.role::text in ('admin','manager','accountant','company_admin','gerant','comptable')
  ) into v_can;
  if not v_can then
    raise exception 'Forbidden';
  end if;

  if p_source_warehouse_id is null or p_destination_warehouse_id is null then
    raise exception 'source_warehouse_id and destination_warehouse_id required';
  end if;

  if p_source_warehouse_id = p_destination_warehouse_id then
    raise exception 'Source and destination warehouses must differ';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'items must be a non-empty array';
  end if;

  perform 1 from public.warehouses w where w.id = p_source_warehouse_id and w.company_id = p_company_id and w.deleted_at is null;
  if not found then raise exception 'Source warehouse not found'; end if;

  perform 1 from public.warehouses w where w.id = p_destination_warehouse_id and w.company_id = p_company_id and w.deleted_at is null;
  if not found then raise exception 'Destination warehouse not found'; end if;

  v_doc_number := public.next_stock_document_number('BT');

  insert into public.stock_documents (
    company_id,
    created_by,
    document_type,
    document_number,
    note,
    source_warehouse_id,
    destination_warehouse_id
  ) values (
    p_company_id,
    v_user_id,
    'transfer',
    v_doc_number,
    nullif(trim(p_note), ''),
    p_source_warehouse_id,
    p_destination_warehouse_id
  ) returning id into v_doc_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;

    if v_product_id is null then
      raise exception 'Each item must have product_id';
    end if;

    if v_qty is null or v_qty <= 0 then
      raise exception 'Each item must have quantity > 0';
    end if;

    insert into public.stock_document_items (document_id, product_id, quantity)
    values (v_doc_id, v_product_id, v_qty);

    perform public.apply_warehouse_stock_movement(
      p_company_id,
      v_user_id,
      'TRANSFER',
      v_product_id,
      v_qty,
      null,
      p_source_warehouse_id,
      p_destination_warehouse_id,
      'stock_document',
      v_doc_id,
      nullif(trim(p_note), '')
    );
  end loop;

  return v_doc_id;
end;
$$;

create or replace function public.create_stock_entry_document(
  p_company_id uuid,
  p_warehouse_id uuid,
  p_items jsonb,
  p_note text default null,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_doc_id uuid;
  v_doc_number text;
  v_item jsonb;
  v_product_id uuid;
  v_qty numeric;
  v_apply boolean;
  v_new_sale numeric;
  v_new_vat numeric;
  v_old_sale numeric;
  v_old_vat numeric;
  v_can boolean;
begin
  if auth.uid() is null then
    if current_user not in ('postgres','service_role','supabase_admin')
       and session_user not in ('postgres','service_role','supabase_admin') then
      raise exception 'Not authenticated';
    end if;
    if p_created_by is null then
      raise exception 'created_by required';
    end if;
  end if;

  v_user_id := coalesce(auth.uid(), p_created_by);
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select exists(
    select 1
    from public.company_users cu
    where cu.company_id = p_company_id
      and cu.user_id = v_user_id
      and cu.role::text in ('admin','manager','accountant','company_admin','gerant','comptable')
  ) into v_can;
  if not v_can then
    raise exception 'Forbidden';
  end if;

  if p_warehouse_id is null then
    raise exception 'warehouse_id required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'items must be a non-empty array';
  end if;

  perform 1 from public.warehouses w where w.id = p_warehouse_id and w.company_id = p_company_id and w.deleted_at is null;
  if not found then raise exception 'Warehouse not found'; end if;

  v_doc_number := public.next_stock_document_number('BE');

  insert into public.stock_documents (
    company_id,
    created_by,
    document_type,
    document_number,
    note,
    warehouse_id
  ) values (
    p_company_id,
    v_user_id,
    'entry',
    v_doc_number,
    nullif(trim(p_note), ''),
    p_warehouse_id
  ) returning id into v_doc_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;
    v_apply := coalesce((v_item->>'apply_pricing_updates')::boolean, false);
    v_new_sale := nullif(v_item->>'new_sale_price','')::numeric;
    v_new_vat := nullif(v_item->>'new_vat_rate','')::numeric;

    if v_product_id is null then
      raise exception 'Each item must have product_id';
    end if;

    if v_qty is null or v_qty <= 0 then
      raise exception 'Each item must have quantity > 0';
    end if;

    insert into public.stock_document_items (
      document_id,
      product_id,
      quantity,
      apply_pricing_updates,
      new_sale_price,
      new_vat_rate
    ) values (
      v_doc_id,
      v_product_id,
      v_qty,
      v_apply,
      v_new_sale,
      v_new_vat
    );

    if v_apply and (v_new_sale is not null or v_new_vat is not null) then
      select sale_price, vat_rate into v_old_sale, v_old_vat
      from public.products
      where id = v_product_id
      for update;

      update public.products
        set sale_price = coalesce(v_new_sale, sale_price),
            vat_rate = coalesce(v_new_vat, vat_rate)
      where id = v_product_id;

      insert into public.product_pricing_history (
        company_id,
        product_id,
        document_id,
        changed_by,
        old_sale_price,
        new_sale_price,
        old_vat_rate,
        new_vat_rate
      ) values (
        p_company_id,
        v_product_id,
        v_doc_id,
        v_user_id,
        v_old_sale,
        coalesce(v_new_sale, v_old_sale),
        v_old_vat,
        coalesce(v_new_vat, v_old_vat)
      );
    end if;

    perform public.apply_warehouse_stock_movement(
      p_company_id,
      v_user_id,
      'IN',
      v_product_id,
      v_qty,
      p_warehouse_id,
      null,
      null,
      'stock_document',
      v_doc_id,
      nullif(trim(p_note), '')
    );
  end loop;

  return v_doc_id;
end;
$$;

commit;
