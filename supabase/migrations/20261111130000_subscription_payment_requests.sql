begin;

create table if not exists public.subscription_payment_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  plan_id uuid not null references public.plans(id) on delete restrict,
  payment_method text not null check (payment_method in ('cash_deposit', 'bank_transfer')),
  payment_reference text,
  payment_note text,
  proof_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists subscription_payment_requests_company_created_idx
  on public.subscription_payment_requests (company_id, created_at desc);
create index if not exists subscription_payment_requests_status_created_idx
  on public.subscription_payment_requests (status, created_at desc);
create unique index if not exists subscription_payment_requests_one_pending_per_company
  on public.subscription_payment_requests (company_id)
  where status = 'pending';

alter table public.subscription_payment_requests enable row level security;
grant select, insert on public.subscription_payment_requests to authenticated;
grant select on public.plans, public.plan_features to anon, authenticated;

drop policy if exists subscription_payment_requests_company_read on public.subscription_payment_requests;
create policy subscription_payment_requests_company_read
  on public.subscription_payment_requests
  for select
  to authenticated
  using (
    public.has_global_role('SUPER_ADMIN', auth.uid())
    or exists (
      select 1 from public.user_company_roles ucr
      where ucr.user_id = auth.uid()
        and ucr.company_id = subscription_payment_requests.company_id
    )
    or exists (
      select 1 from public.company_users cu
      where cu.user_id = auth.uid()
        and cu.company_id = subscription_payment_requests.company_id
    )
  );

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
      where p.id = subscription_payment_requests.plan_id and p.active = true
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

-- Active plans and their feature descriptions are visible on the public pricing page.
drop policy if exists plans_public_active_read on public.plans;
create policy plans_public_active_read
  on public.plans
  for select
  to anon, authenticated
  using (active = true);

drop policy if exists plan_features_public_read on public.plan_features;
create policy plan_features_public_read
  on public.plan_features
  for select
  to anon, authenticated
  using (exists (
    select 1 from public.plans p
    where p.id = plan_features.plan_id and p.active = true
  ));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'subscription-proofs',
  'subscription-proofs',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists subscription_proofs_company_upload on storage.objects;
create policy subscription_proofs_company_upload
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'subscription-proofs'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (
      exists (
        select 1 from public.user_company_roles ucr
        where ucr.user_id = auth.uid()
          and ucr.company_id::text = (storage.foldername(name))[1]
      )
      or exists (
        select 1 from public.company_users cu
        where cu.user_id = auth.uid()
          and cu.company_id::text = (storage.foldername(name))[1]
      )
    )
  );

drop policy if exists subscription_proofs_super_admin_read on storage.objects;
create policy subscription_proofs_super_admin_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'subscription-proofs'
    and public.has_global_role('SUPER_ADMIN', auth.uid())
  );

drop policy if exists subscription_proofs_uploader_read on storage.objects;
create policy subscription_proofs_uploader_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'subscription-proofs'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (
      exists (
        select 1 from public.user_company_roles ucr
        where ucr.user_id = auth.uid()
          and ucr.company_id::text = (storage.foldername(name))[1]
      )
      or exists (
        select 1 from public.company_users cu
        where cu.user_id = auth.uid()
          and cu.company_id::text = (storage.foldername(name))[1]
      )
    )
  );

drop policy if exists subscription_proofs_uploader_delete on storage.objects;
create policy subscription_proofs_uploader_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'subscription-proofs'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (
      exists (
        select 1 from public.user_company_roles ucr
        where ucr.user_id = auth.uid()
          and ucr.company_id::text = (storage.foldername(name))[1]
      )
      or exists (
        select 1 from public.company_users cu
        where cu.user_id = auth.uid()
          and cu.company_id::text = (storage.foldername(name))[1]
      )
    )
  );

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
  v_expires_at timestamptz;
begin
  if not public.has_global_role('SUPER_ADMIN', auth.uid()) then
    raise exception 'not authorized';
  end if;

  if p_active and p_plan_id is null then
    raise exception 'An active subscription requires a plan';
  end if;

  if p_active then
    select duration into v_duration
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

    v_expires_at := coalesce(
      p_expires_at,
      case
        when lower(v_duration) ~ '(month|mois)' then now() + interval '1 month'
        when lower(v_duration) ~ '(week|semaine)' then now() + interval '1 week'
        when lower(v_duration) ~ '(day|jour)' then now() + interval '1 day'
        else now() + interval '1 year'
      end
    );

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
       set is_paid = true,
           paid_until = v_expires_at,
           lifetime = false,
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
           lifetime = false
     where company_id = p_company_id;
  end if;
end;
$$;

create or replace function public.admin_review_subscription_request(
  p_request_id uuid,
  p_decision text,
  p_review_note text default null,
  p_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.subscription_payment_requests%rowtype;
begin
  if not public.has_global_role('SUPER_ADMIN', auth.uid()) then
    raise exception 'not authorized';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid decision';
  end if;

  select * into v_request
  from public.subscription_payment_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Payment request not found';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Payment request has already been reviewed';
  end if;

  if p_decision = 'approved' then
    perform public.admin_set_company_plan(
      v_request.company_id,
      v_request.plan_id,
      true,
      p_expires_at
    );
  end if;

  update public.subscription_payment_requests
     set status = p_decision,
         review_note = nullif(trim(p_review_note), ''),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_request_id;
end;
$$;

grant execute on function public.admin_set_company_plan(uuid, uuid, boolean, timestamptz) to authenticated;
grant execute on function public.admin_review_subscription_request(uuid, text, text, timestamptz) to authenticated;

commit;
