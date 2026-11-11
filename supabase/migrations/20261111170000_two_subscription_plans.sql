begin;

alter table public.company_access
  add column if not exists free_plan_active boolean not null default false;

do $$
declare
  v_free_plan_id uuid;
  v_pro_plan_id uuid;
begin
  select id into v_free_plan_id
  from public.plans
  where lower(trim(name)) = 'gratuit'
  order by created_at
  limit 1;

  if v_free_plan_id is null then
    insert into public.plans (name, description, price_year, duration, active, display_order)
    values ('Gratuit', '15 factures par mois et 1 utilisateur', 0, 'sans limite de durée', false, 1)
    returning id into v_free_plan_id;
  end if;

  select id into v_pro_plan_id
  from public.plans
  where lower(trim(name)) = 'pro'
  order by created_at
  limit 1;

  if v_pro_plan_id is null then
    insert into public.plans (name, description, price_year, duration, active, display_order)
    values ('Pro', 'Toutes les fonctionnalités, factures et utilisateurs illimités', 350, 'annuel', false, 2)
    returning id into v_pro_plan_id;
  end if;

  update public.plans
     set active = false;

  update public.plans
     set name = 'Gratuit',
         description = '15 factures par mois et 1 utilisateur',
         price_year = 0,
         duration = 'sans limite de durée',
         active = true,
         display_order = 1
   where id = v_free_plan_id;

  update public.plans
     set name = 'Pro',
         description = 'Toutes les fonctionnalités, factures et utilisateurs illimités',
         price_year = 350,
         duration = 'annuel',
         active = true,
         display_order = 2
   where id = v_pro_plan_id;

  delete from public.plan_features
   where plan_id in (v_free_plan_id, v_pro_plan_id);

  insert into public.plan_features (plan_id, key, value)
  values
    (v_free_plan_id, 'billing.max_invoices_per_month', '{"value":15}'::jsonb),
    (v_free_plan_id, 'users.max_users', '{"value":1}'::jsonb),
    (v_pro_plan_id, 'billing.invoices_unlimited', '{"enabled":true}'::jsonb),
    (v_pro_plan_id, 'billing.invoice_edit', '{"enabled":true}'::jsonb),
    (v_pro_plan_id, 'billing.pdf_watermark', '{"enabled":false}'::jsonb),
    (v_pro_plan_id, 'users.max_users', '{"value":0}'::jsonb),
    (v_pro_plan_id, 'stock.readonly', '{"enabled":true}'::jsonb),
    (v_pro_plan_id, 'stock.manage_products', '{"enabled":true}'::jsonb),
    (v_pro_plan_id, 'stock.stock_alerts', '{"enabled":true}'::jsonb),
    (v_pro_plan_id, 'export.csv', '{"enabled":true}'::jsonb),
    (v_pro_plan_id, 'reports.access', '{"enabled":true}'::jsonb),
    (v_pro_plan_id, 'accounting.access', '{"enabled":true}'::jsonb);

  update public.company_plans
     set expires_at = null
   where plan_id = v_free_plan_id
     and active = true;

  update public.company_access ca
     set is_paid = false,
         paid_until = null,
         lifetime = false,
         free_plan_active = true,
         restricted = false
   where exists (
     select 1
     from public.company_plans cp
     where cp.company_id = ca.company_id
       and cp.plan_id = v_free_plan_id
       and cp.active = true
   );
end;
$$;

create or replace function public.compute_company_access(p_company_id uuid)
returns table(
  company_id uuid,
  restricted boolean,
  in_trial boolean,
  trial_days_left integer,
  paid_active boolean,
  trial_ends_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_trial_ends timestamptz;
  v_is_paid boolean;
  v_paid_until timestamptz;
  v_lifetime boolean;
  v_free_plan_active boolean;
  v_paid_active boolean;
  v_restricted boolean;
  v_in_trial boolean;
  v_days_left integer;
  v_seconds_left numeric;
begin
  perform public.ensure_company_access(p_company_id);

  select ca.trial_ends_at, ca.is_paid, ca.paid_until, ca.lifetime, ca.free_plan_active
    into v_trial_ends, v_is_paid, v_paid_until, v_lifetime, v_free_plan_active
  from public.company_access ca
  where ca.company_id = p_company_id;

  v_paid_active := (v_is_paid = true) and (v_lifetime = true or (v_paid_until is not null and v_paid_until > now()));
  v_in_trial := (not v_paid_active) and (not v_free_plan_active) and (now() < v_trial_ends);
  v_restricted := (not v_paid_active) and (not v_free_plan_active) and (now() >= v_trial_ends);

  v_seconds_left := extract(epoch from (v_trial_ends - now()));
  if v_seconds_left <= 0 then
    v_days_left := 0;
  else
    v_days_left := ceil(v_seconds_left / 86400.0);
  end if;

  update public.company_access
     set restricted = v_restricted,
         last_computed_at = now()
   where company_id = p_company_id;

  return query select p_company_id, v_restricted, v_in_trial, v_days_left, v_paid_active, v_trial_ends;
end;
$$;

create or replace function public.admin_set_company_plan(
  p_company_id uuid,
  p_plan_id uuid,
  p_active boolean,
  p_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_company_plan_id uuid;
  v_duration text;
  v_price numeric;
  v_expires_at timestamptz;
begin
  if not public.has_global_role('SUPER_ADMIN', auth.uid()) then
    raise exception 'not authorized';
  end if;

  if p_active and p_plan_id is null then
    raise exception 'An active subscription requires a plan';
  end if;

  if p_active then
    select duration, price_year into v_duration, v_price
    from public.plans
    where id = p_plan_id and active = true;

    if not found then
      raise exception 'Plan not found or inactive';
    end if;

    select user_id into v_user_id
    from public.company_users
    where company_id = p_company_id
    order by case when role::text = 'company_admin' then 0 else 1 end
    limit 1;

    if v_user_id is null then
      select user_id into v_user_id
      from public.user_company_roles
      where company_id = p_company_id
      order by case when role::text in ('COMPANY_ADMIN', 'company_admin') then 0 else 1 end
      limit 1;
    end if;

    if v_user_id is null then
      raise exception 'No company member found to assign the subscription';
    end if;

    v_expires_at := case
      when v_price = 0 then null
      else coalesce(
        p_expires_at,
        case
          when lower(v_duration) ~ '(month|mois)' then now() + interval '1 month'
          when lower(v_duration) ~ '(week|semaine)' then now() + interval '1 week'
          when lower(v_duration) ~ '(day|jour)' then now() + interval '1 day'
          else now() + interval '1 year'
        end
      )
    end;

    update public.company_plans
       set active = false
     where company_id = p_company_id;

    select id into v_company_plan_id
    from public.company_plans
    where company_id = p_company_id
    order by started_at desc nulls last, assigned_at desc nulls last
    limit 1
    for update;

    if v_company_plan_id is null then
      insert into public.company_plans (
        company_id, plan_id, user_id, active, started_at, expires_at, assigned_at
      )
      values (
        p_company_id, p_plan_id, v_user_id, true, now(), v_expires_at, now()
      );
    else
      update public.company_plans
         set plan_id = p_plan_id,
             user_id = v_user_id,
             active = true,
             started_at = now(),
             expires_at = v_expires_at,
             assigned_at = now()
       where id = v_company_plan_id;
    end if;

    perform public.ensure_company_access(p_company_id);
    update public.company_access
       set is_paid = v_price > 0,
           paid_until = case when v_price > 0 then v_expires_at else null end,
           lifetime = false,
           free_plan_active = v_price = 0,
           restricted = false
     where company_id = p_company_id;
  else
    update public.company_plans
       set active = false
     where company_id = p_company_id;

    perform public.ensure_company_access(p_company_id);
    update public.company_access
       set is_paid = false,
           paid_until = null,
           lifetime = false,
           free_plan_active = false
     where company_id = p_company_id;
  end if;
end;
$$;

create or replace function public.activate_free_company_plan(
  p_company_id uuid,
  p_plan_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_plan_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not (
    exists (
      select 1 from public.user_company_roles ucr
      where ucr.user_id = v_user_id and ucr.company_id = p_company_id
    )
    or exists (
      select 1 from public.company_users cu
      where cu.user_id = v_user_id and cu.company_id = p_company_id
    )
  ) then
    raise exception 'Not a member of this company';
  end if;

  if not exists (
    select 1 from public.plans p
    where p.id = p_plan_id and p.active = true and p.price_year = 0
  ) then
    raise exception 'Free plan not found or inactive';
  end if;

  if exists (
    select 1 from public.subscription_payment_requests spr
    where spr.company_id = p_company_id and spr.status = 'pending'
  ) then
    raise exception 'A subscription request is already pending';
  end if;

  if exists (
    select 1
    from public.company_plans cp
    join public.plans p on p.id = cp.plan_id
    where cp.company_id = p_company_id
      and cp.active = true
      and p.price_year > 0
      and (cp.expires_at is null or cp.expires_at > now())
  ) or exists (
    select 1 from public.company_access ca
    where ca.company_id = p_company_id
      and ca.is_paid = true
      and (ca.lifetime = true or ca.paid_until > now())
  ) then
    raise exception 'An active paid subscription cannot be replaced with the free plan';
  end if;

  perform public.ensure_company_access(p_company_id);
  select id into v_company_plan_id
  from public.company_plans
  where company_id = p_company_id
  limit 1
  for update;

  if v_company_plan_id is null then
    insert into public.company_plans (
      company_id, plan_id, user_id, active, started_at, expires_at, assigned_at
    )
    values (p_company_id, p_plan_id, v_user_id, true, now(), null, now());
  else
    update public.company_plans
       set plan_id = p_plan_id,
           user_id = v_user_id,
           active = true,
           started_at = now(),
           expires_at = null,
           assigned_at = now()
     where id = v_company_plan_id;
  end if;

  update public.company_access
     set is_paid = false,
         paid_until = null,
         lifetime = false,
         free_plan_active = true,
         restricted = false
   where company_id = p_company_id;
end;
$$;

grant execute on function public.activate_free_company_plan(uuid, uuid) to authenticated;

drop policy if exists subscription_payment_requests_company_insert on public.subscription_payment_requests;
create policy subscription_payment_requests_company_insert
  on public.subscription_payment_requests
  for insert
  to authenticated
  with check (
    requested_by = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and proof_path like company_id::text || '/' || auth.uid()::text || '/%'
    and exists (
      select 1 from public.plans p
      where p.id = subscription_payment_requests.plan_id
        and p.active = true
        and p.price_year > 0
    )
    and exists (
      select 1 from storage.objects o
      where o.bucket_id = 'subscription-proofs'
        and o.name = subscription_payment_requests.proof_path
    )
    and (
      exists (
        select 1 from public.user_company_roles ucr
        where ucr.user_id = auth.uid()
          and ucr.company_id = subscription_payment_requests.company_id
      )
      or exists (
        select 1 from public.company_users cu
        where cu.user_id = auth.uid()
          and cu.company_id = subscription_payment_requests.company_id
      )
    )
  );

commit;
