-- Legacy products stock migration: create one Bon d’entrée per company
-- using the same RPC used by the UI.
--
-- Rules:
-- - Do NOT assume stock exists in any warehouse.
-- - Ensure a default warehouse exists per company ("Dépôt principal").
-- - Create a stock document with note 'migration_initial_stock'.
-- - Use quantity = products.initial_qty.
-- - Apply movements atomically via create_stock_entry_document().

begin;

do $$
declare
  c record;
  v_default_warehouse_id uuid;
  v_actor uuid;
  v_items jsonb;
  v_doc_id uuid;
begin
  for c in select id from public.companies
  loop
    -- Pick an actor user (company_admin > gerant > comptable > oldest member)
    select cu.user_id
      into v_actor
    from public.company_users cu
    where cu.company_id = c.id
    order by
      (cu.role::text = 'company_admin') desc,
      (cu.role::text = 'gerant') desc,
      (cu.role::text = 'comptable') desc,
      cu.created_at asc
    limit 1;

    if v_actor is null then
      continue;
    end if;

    -- Skip if already migrated
    if exists (
      select 1
      from public.stock_documents d
      where d.company_id = c.id
        and d.document_type = 'entry'
        and d.note = 'migration_initial_stock'
    ) then
      continue;
    end if;

    v_default_warehouse_id := public.ensure_default_warehouse_id(c.id);

    -- Build items list only for products that have no per-warehouse stock rows yet
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'product_id', p.id,
          'quantity', p.initial_qty,
          'apply_pricing_updates', false
        )
      ),
      '[]'::jsonb
    )
    into v_items
    from public.products p
    where p.company_id = c.id
      and coalesce(p.initial_qty, 0) > 0
      and not exists (
        select 1
        from public.warehouse_products wp
        join public.warehouses w on w.id = wp.warehouse_id
        where wp.product_id = p.id
          and w.company_id = c.id
          and w.deleted_at is null
      );

    if jsonb_array_length(v_items) = 0 then
      continue;
    end if;

    -- Reset product.quantity for migrated products to avoid double counting when applying IN
    update public.products
      set quantity = 0
    where company_id = c.id
      and id in (
        select (x->>'product_id')::uuid
        from jsonb_array_elements(v_items) x
      );

    v_doc_id := public.create_stock_entry_document(
      c.id,
      v_default_warehouse_id,
      v_items,
      'migration_initial_stock',
      v_actor
    );

    perform v_doc_id;
  end loop;
end $$;

commit;
