-- Fix accounts.type check constraint violations caused by legacy FR type labels
-- Ensure RPC helper uses allowed types: asset|liability|equity|income|expense

begin;

create or replace function public.ensure_company_account(
  p_company_id uuid,
  p_code text,
  p_name text,
  p_type text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_type text;
begin
  select id into v_id
  from public.accounts
  where company_id = p_company_id and code = p_code
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  v_type := lower(coalesce(p_type, 'asset'));
  v_type := case
    when v_type in ('asset', 'actif') then 'asset'
    when v_type in ('liability', 'passif') then 'liability'
    when v_type in ('equity', 'capitaux', 'capitaux_propres') then 'equity'
    when v_type in ('income', 'produit', 'revenu') then 'income'
    when v_type in ('expense', 'charge') then 'expense'
    else 'asset'
  end;

  insert into public.accounts(company_id, user_id, code, name, type)
  values (p_company_id, auth.uid(), p_code, p_name, v_type)
  returning id into v_id;

  return v_id;
end;
$$;

-- If older rows exist with FR labels, normalize them too
update public.accounts
set type = case lower(type)
  when 'actif' then 'asset'
  when 'passif' then 'liability'
  when 'charge' then 'expense'
  when 'produit' then 'income'
  when 'capitaux' then 'equity'
  when 'capitaux_propres' then 'equity'
  else type
end
where lower(type) in ('actif','passif','charge','produit','capitaux','capitaux_propres');

commit;
