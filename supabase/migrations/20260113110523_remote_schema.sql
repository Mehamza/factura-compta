drop trigger if exists "update_warehouse_products_updated_at" on "public"."warehouse_products";

drop trigger if exists "prevent_delete_default_warehouse_trg" on "public"."warehouses";

drop policy "product_pricing_history_insert_privileged" on "public"."product_pricing_history";

drop policy "stock_document_items_insert_privileged" on "public"."stock_document_items";

drop policy "stock_documents_insert_privileged" on "public"."stock_documents";

alter table "public"."warehouse_products" drop constraint "warehouse_products_max_nonneg";

alter table "public"."warehouse_products" drop constraint "warehouse_products_min_le_max";

alter table "public"."warehouse_products" drop constraint "warehouse_products_min_nonneg";

alter table "public"."warehouse_products" drop constraint "warehouse_products_qty_nonneg";

drop function if exists "public"."enforce_credit_note_source_company"();

drop function if exists "public"."enforce_credit_note_stamp"();

drop function if exists "public"."get_default_warehouse_id"(p_company_id uuid);

drop function if exists "public"."prevent_delete_default_warehouse"();

drop function if exists "public"."prevent_delete_validated_invoice"();

drop function if exists "public"."prevent_update_validated_credit_note"();

drop function if exists "public"."trg_invoice_items_compute_amounts"();

drop index if exists "public"."idx_invoices_source_invoice_id";

drop index if exists "public"."warehouse_products_product_idx";

drop index if exists "public"."warehouse_products_wh_product_uq";

drop index if exists "public"."warehouses_company_active_idx";

drop index if exists "public"."warehouses_company_code_uq";

drop index if exists "public"."warehouses_one_default_per_company_uq";

alter table "public"."warehouse_products" drop column "max_quantity";

alter table "public"."warehouse_products" drop column "min_quantity";

alter table "public"."warehouse_products" add column "max_stock" numeric;

alter table "public"."warehouse_products" add column "min_stock" numeric default 0;

alter table "public"."warehouse_products" alter column "created_at" drop not null;

alter table "public"."warehouse_products" alter column "quantity" drop not null;

alter table "public"."warehouse_products" alter column "updated_at" drop not null;

alter table "public"."warehouses" alter column "country" set default 'Tunisie'::text;

alter table "public"."warehouses" alter column "created_at" drop not null;

alter table "public"."warehouses" alter column "is_active" drop not null;

alter table "public"."warehouses" alter column "is_default" drop not null;

alter table "public"."warehouses" alter column "updated_at" drop not null;

CREATE UNIQUE INDEX warehouse_products_warehouse_id_product_id_key ON public.warehouse_products USING btree (warehouse_id, product_id);

alter table "public"."warehouse_products" add constraint "warehouse_products_warehouse_id_product_id_key" UNIQUE using index "warehouse_products_warehouse_id_product_id_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.ensure_default_warehouse_id(p_company_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;


  create policy "product_pricing_history_insert_privileged"
  on "public"."product_pricing_history"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.company_users cu
  WHERE ((cu.company_id = product_pricing_history.company_id) AND (cu.user_id = auth.uid()) AND (cu.role = ANY (ARRAY['caissier'::public.company_role, 'company_admin'::public.company_role, 'gerant'::public.company_role, 'comptable'::public.company_role]))))));



  create policy "stock_document_items_insert_privileged"
  on "public"."stock_document_items"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM (public.stock_documents d
     JOIN public.company_users cu ON (((cu.company_id = d.company_id) AND (cu.user_id = auth.uid()) AND (cu.role = ANY (ARRAY['caissier'::public.company_role, 'company_admin'::public.company_role, 'gerant'::public.company_role, 'comptable'::public.company_role])))))
  WHERE (d.id = stock_document_items.document_id))));



  create policy "stock_documents_insert_privileged"
  on "public"."stock_documents"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.company_users cu
  WHERE ((cu.company_id = stock_documents.company_id) AND (cu.user_id = auth.uid()) AND (cu.role = ANY (ARRAY['caissier'::public.company_role, 'company_admin'::public.company_role, 'gerant'::public.company_role, 'comptable'::public.company_role]))))));



