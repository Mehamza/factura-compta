-- Fix onboarding company creation failing with 403/42501 when using PostgREST
-- `insert(...).select('*')` (RETURNING requires SELECT policy to pass).
--
-- Approach:
-- - Add companies.created_by default auth.uid()
-- - Allow SELECT/UPDATE for the creating user until membership is established
-- - Tighten INSERT so created_by must match auth.uid()

begin;

alter table public.companies
  add column if not exists created_by uuid;

-- Default to the current authenticated user when inserting via API.
alter table public.companies
  alter column created_by set default auth.uid();

-- Backfill created_by from existing company membership when possible.
-- Prefer company_admin; otherwise any member.
update public.companies c
set created_by = cu.user_id
from public.company_users cu
where cu.company_id = c.id
  and c.created_by is null
  and cu.role = 'company_admin'::public.company_role;

update public.companies c
set created_by = cu.user_id
from public.company_users cu
where cu.company_id = c.id
  and c.created_by is null;

-- --- Policies ---

-- INSERT: only authenticated users, and they can only create rows attributed to themselves.
drop policy if exists companies_authenticated_insert on public.companies;
create policy companies_authenticated_insert
on public.companies
for insert
with check (
  auth.uid() is not null
  and created_by = auth.uid()
);

-- SELECT: allow creator to read their own company row (needed for RETURNING),
-- plus existing membership-based access.
drop policy if exists companies_company_members_select on public.companies;
create policy companies_company_members_select
on public.companies
for select
using (
  public.is_super_admin(auth.uid())
  or created_by = auth.uid()
  or exists (
    select 1
    from public.company_users cu
    where cu.company_id = companies.id
      and cu.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.user_company_roles ucr
    where ucr.company_id = companies.id
      and ucr.user_id = auth.uid()
  )
);

-- UPDATE: allow creator (bootstrap) or company managers.
drop policy if exists companies_company_managers_update on public.companies;
create policy companies_company_managers_update
on public.companies
for update
using (
  public.is_super_admin(auth.uid())
  or created_by = auth.uid()
  or public.can_manage_company_users(auth.uid(), companies.id)
)
with check (
  public.is_super_admin(auth.uid())
  or created_by = auth.uid()
  or public.can_manage_company_users(auth.uid(), companies.id)
);

commit;
