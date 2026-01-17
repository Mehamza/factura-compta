-- Allow authenticated users to create a company (onboarding)
-- and allow company members to read/update their company.
-- Also tighten company_users self-insert to only allow the first membership row.

begin;

-- Ensure RLS is enabled
alter table public.companies enable row level security;
alter table public.company_users enable row level security;

-- --- companies policies ---

-- Authenticated users can create a company (no owner column exists to bind it).
drop policy if exists companies_authenticated_insert on public.companies;
create policy companies_authenticated_insert
on public.companies
for insert
with check (auth.uid() is not null);

-- Company members can read company rows (supports both new and legacy membership tables).
drop policy if exists companies_company_members_select on public.companies;
create policy companies_company_members_select
on public.companies
for select
using (
  public.is_super_admin(auth.uid())
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

-- Company admins/managers can update their company settings.
drop policy if exists companies_company_managers_update on public.companies;
create policy companies_company_managers_update
on public.companies
for update
using (
  public.can_manage_company_users(auth.uid(), companies.id)
  or public.is_super_admin(auth.uid())
)
with check (
  public.can_manage_company_users(auth.uid(), companies.id)
  or public.is_super_admin(auth.uid())
);

-- --- company_users policies ---

-- Tighten: self-insert is only allowed to bootstrap a brand-new company.
-- Without this, a user could add themselves as admin to any company_id.
drop policy if exists "Team managers can add members" on public.company_users;
create policy "Team managers can add members"
on public.company_users
for insert
with check (
  public.can_manage_company_users(auth.uid(), company_id)
  or (
    auth.uid() = user_id
    and role = 'company_admin'::public.company_role
    and not exists (
      select 1
      from public.company_users cu2
      where cu2.company_id = company_users.company_id
    )
  )
);

commit;
