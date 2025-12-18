-- Production hardening: ensure public signups do NOT get admin by default.
-- Default role for new auth.users inserts is set to 'cashier' (least privilege among app roles).

begin;

-- Ensure default is least-privileged
alter table public.user_roles
  alter column role set default 'cashier'::public.app_role;

-- Ensure signup trigger assigns cashier (idempotent)
create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'cashier'::public.app_role)
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_role on auth.users;
create trigger on_auth_user_created_role
after insert on auth.users
for each row execute function public.handle_new_user_role();

commit;
