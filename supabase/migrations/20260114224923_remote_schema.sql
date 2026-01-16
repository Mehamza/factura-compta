set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.ensure_company_account(p_company_id uuid, p_code text, p_name text, p_type text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;


