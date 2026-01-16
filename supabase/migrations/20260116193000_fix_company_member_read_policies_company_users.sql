-- Fix company-member visibility for core tables.
--
-- Problem: older "*_company_members_read" policies rely on `public.user_company_roles`,
-- but the current app uses `public.company_users` for membership.
-- If `user_company_roles` is empty, team members (e.g. cashier) see 0 rows.
--
-- Solution: re-create SELECT policies to accept either membership table.

begin;

-- --- clients ---
alter table public.clients enable row level security;
drop policy if exists clients_company_members_read on public.clients;
create policy clients_company_members_read
on public.clients
for select
using (
  public.has_global_role('SUPER_ADMIN', auth.uid())
  or (
    clients.company_id is not null
    and (
      exists (
        select 1 from public.company_users cu
        where cu.user_id = auth.uid()
          and cu.company_id = clients.company_id
      )
      or exists (
        select 1 from public.user_company_roles ucr
        where ucr.user_id = auth.uid()
          and ucr.company_id = clients.company_id
      )
    )
  )
);

-- --- suppliers ---
alter table public.suppliers enable row level security;
drop policy if exists suppliers_company_members_read on public.suppliers;
create policy suppliers_company_members_read
on public.suppliers
for select
using (
  public.has_global_role('SUPER_ADMIN', auth.uid())
  or (
    suppliers.company_id is not null
    and (
      exists (
        select 1 from public.company_users cu
        where cu.user_id = auth.uid()
          and cu.company_id = suppliers.company_id
      )
      or exists (
        select 1 from public.user_company_roles ucr
        where ucr.user_id = auth.uid()
          and ucr.company_id = suppliers.company_id
      )
    )
  )
);

-- --- products ---
alter table public.products enable row level security;
drop policy if exists products_company_members_read on public.products;
create policy products_company_members_read
on public.products
for select
using (
  public.has_global_role('SUPER_ADMIN', auth.uid())
  or (
    products.company_id is not null
    and (
      exists (
        select 1 from public.company_users cu
        where cu.user_id = auth.uid()
          and cu.company_id = products.company_id
      )
      or exists (
        select 1 from public.user_company_roles ucr
        where ucr.user_id = auth.uid()
          and ucr.company_id = products.company_id
      )
    )
  )
);

-- --- invoices ---
alter table public.invoices enable row level security;
drop policy if exists invoices_company_members_read on public.invoices;
create policy invoices_company_members_read
on public.invoices
for select
using (
  public.has_global_role('SUPER_ADMIN', auth.uid())
  or (
    invoices.company_id is not null
    and (
      exists (
        select 1 from public.company_users cu
        where cu.user_id = auth.uid()
          and cu.company_id = invoices.company_id
      )
      or exists (
        select 1 from public.user_company_roles ucr
        where ucr.user_id = auth.uid()
          and ucr.company_id = invoices.company_id
      )
    )
  )
);

-- --- invoice_items ---
alter table public.invoice_items enable row level security;
drop policy if exists invoice_items_company_members_read on public.invoice_items;
create policy invoice_items_company_members_read
on public.invoice_items
for select
using (
  public.has_global_role('SUPER_ADMIN', auth.uid())
  or (
    invoice_items.company_id is not null
    and (
      exists (
        select 1 from public.company_users cu
        where cu.user_id = auth.uid()
          and cu.company_id = invoice_items.company_id
      )
      or exists (
        select 1 from public.user_company_roles ucr
        where ucr.user_id = auth.uid()
          and ucr.company_id = invoice_items.company_id
      )
    )
  )
);

-- --- payments ---
-- Keep existing insert/update/delete rules (including purchase_quote enforcement).
-- Only broaden SELECT to company membership.
alter table public.payments enable row level security;
drop policy if exists pay_select on public.payments;
create policy pay_select
on public.payments
for select
using (
  public.has_global_role('SUPER_ADMIN', auth.uid())
  or (
    payments.company_id is not null
    and (
      exists (
        select 1 from public.company_users cu
        where cu.user_id = auth.uid()
          and cu.company_id = payments.company_id
      )
      or exists (
        select 1 from public.user_company_roles ucr
        where ucr.user_id = auth.uid()
          and ucr.company_id = payments.company_id
      )
    )
  )
  or (payments.company_id is null and payments.user_id = auth.uid())
);

commit;
