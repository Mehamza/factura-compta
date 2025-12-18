-- From now on, do not use the legacy 'user' role.
-- New signups should get a real staff role.
-- Default chosen: 'cashier' (least-privileged in the current app).

begin;

-- Migrate existing rows away from 'user'
update public.user_roles
set role = 'admin'::public.app_role
where role = 'user'::public.app_role;

-- Ensure new rows default to cashier
alter table public.user_roles
  alter column role set default 'admin'::public.app_role;

-- Ensure signup trigger assigns cashier (idempotent)
create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'admin'::public.app_role)
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_role on auth.users;
create trigger on_auth_user_created_role
after insert on auth.users
for each row execute function public.handle_new_user_role();

commit;
