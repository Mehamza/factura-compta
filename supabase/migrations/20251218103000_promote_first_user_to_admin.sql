-- Promote the first created auth user from role 'user' to 'admin'
-- Safe default: upgrades only the earliest account (typically the project owner).

begin;

with target as (
  select id
  from auth.users
  order by created_at asc
  limit 1
)
update public.user_roles ur
set role = 'admin'::public.app_role
from target t
where ur.user_id = t.id
  and ur.role = 'user'::public.app_role;

with target as (
  select id
  from auth.users
  order by created_at asc
  limit 1
)
insert into public.user_roles (user_id, role)
select t.id, 'admin'::public.app_role
from target t
where not exists (
  select 1
  from public.user_roles ur
  where ur.user_id = t.id
    and ur.role = 'admin'::public.app_role
);

commit;
