-- RLS policies by company: SUPER_ADMIN full access; company members scoped to company_id.

begin;

-- Clients
alter table public.clients enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clients' and policyname='clients_super_admin_all') then
    create policy clients_super_admin_all on public.clients for all using (public.has_global_role('SUPER_ADMIN', auth.uid())) with check (public.has_global_role('SUPER_ADMIN', auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clients' and policyname='clients_company_members_read') then
    create policy clients_company_members_read on public.clients for select using (
      public.has_global_role('SUPER_ADMIN', auth.uid())
      or exists (select 1 from public.user_company_roles ucr where ucr.user_id = auth.uid() and ucr.company_id = clients.company_id)
    );
  end if;
end $$;

-- Suppliers
alter table public.suppliers enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='suppliers' and policyname='suppliers_super_admin_all') then
    create policy suppliers_super_admin_all on public.suppliers for all using (public.has_global_role('SUPER_ADMIN', auth.uid())) with check (public.has_global_role('SUPER_ADMIN', auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='suppliers' and policyname='suppliers_company_members_read') then
    create policy suppliers_company_members_read on public.suppliers for select using (
      public.has_global_role('SUPER_ADMIN', auth.uid())
      or exists (select 1 from public.user_company_roles ucr where ucr.user_id = auth.uid() and ucr.company_id = suppliers.company_id)
    );
  end if;
end $$;

-- Products
alter table public.products enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_super_admin_all') then
    create policy products_super_admin_all on public.products for all using (public.has_global_role('SUPER_ADMIN', auth.uid())) with check (public.has_global_role('SUPER_ADMIN', auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_company_members_read') then
    create policy products_company_members_read on public.products for select using (
      public.has_global_role('SUPER_ADMIN', auth.uid())
      or exists (select 1 from public.user_company_roles ucr where ucr.user_id = auth.uid() and ucr.company_id = products.company_id)
    );
  end if;
end $$;

-- Invoices
alter table public.invoices enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='invoices' and policyname='invoices_super_admin_all') then
    create policy invoices_super_admin_all on public.invoices for all using (public.has_global_role('SUPER_ADMIN', auth.uid())) with check (public.has_global_role('SUPER_ADMIN', auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='invoices' and policyname='invoices_company_members_read') then
    create policy invoices_company_members_read on public.invoices for select using (
      public.has_global_role('SUPER_ADMIN', auth.uid())
      or exists (select 1 from public.user_company_roles ucr where ucr.user_id = auth.uid() and ucr.company_id = invoices.company_id)
    );
  end if;
end $$;

-- Invoice items
alter table public.invoice_items enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='invoice_items' and policyname='invoice_items_super_admin_all') then
    create policy invoice_items_super_admin_all on public.invoice_items for all using (public.has_global_role('SUPER_ADMIN', auth.uid())) with check (public.has_global_role('SUPER_ADMIN', auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='invoice_items' and policyname='invoice_items_company_members_read') then
    create policy invoice_items_company_members_read on public.invoice_items for select using (
      public.has_global_role('SUPER_ADMIN', auth.uid())
      or exists (select 1 from public.user_company_roles ucr where ucr.user_id = auth.uid() and ucr.company_id = invoice_items.company_id)
    );
  end if;
end $$;

commit;
