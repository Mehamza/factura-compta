-- Ensure global-role detection works reliably for authenticated users
-- and remove legacy fallback that could escalate company admins.

begin;

-- 1) Enforce RLS on user_global_roles
alter table if exists public.user_global_roles enable row level security;

-- 2) Ensure has_global_role relies ONLY on user_global_roles
create or replace function public.has_global_role(p_role text, p_user_id uuid)
returns boolean
language sql
stable
as $fn$
  select exists (
    select 1
    from public.user_global_roles ugr
    where ugr.user_id = p_user_id
      and lower(ugr.role) = lower(p_role)
  );
$fn$;

-- 3) Deterministic policies (drop + recreate)
-- Allow authenticated users to read their own global roles
drop policy if exists ugr_select_own on public.user_global_roles;
drop policy if exists "user_global_roles_select_own" on public.user_global_roles;
create policy ugr_select_own
on public.user_global_roles
for select
to authenticated
using (auth.uid() = user_id);

-- Allow SUPER_ADMIN to manage global roles (optional but keeps existing behavior)
drop policy if exists ugr_super_admin_manage on public.user_global_roles;
create policy ugr_super_admin_manage
on public.user_global_roles
for all
to authenticated
using (public.has_global_role('SUPER_ADMIN', auth.uid()))
with check (public.has_global_role('SUPER_ADMIN', auth.uid()));

commit;
