-- Encaissement autonome ("Charger compte")
-- - Inserts a row in account_loads
-- - Creates a balanced journal entry (debit cash/bank account, credit counterpart)

begin;

create table if not exists public.account_loads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  amount numeric(12,2) not null,
  currency text not null default 'TND',
  load_date date not null default current_date,
  origin text,
  notes text,
  attachment_document_id uuid references public.documents(id) on delete set null,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_account_loads_company_date on public.account_loads(company_id, load_date desc);
create index if not exists idx_account_loads_account on public.account_loads(account_id);

-- Trigger updated_at
drop trigger if exists update_account_loads_updated_at on public.account_loads;
create trigger update_account_loads_updated_at
before update on public.account_loads
for each row execute function public.update_updated_at_column();

-- RLS
alter table public.account_loads enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='account_loads' and policyname='account_loads_super_admin_all') then
    create policy account_loads_super_admin_all on public.account_loads for all
      using (public.has_global_role('SUPER_ADMIN', auth.uid()))
      with check (public.has_global_role('SUPER_ADMIN', auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='account_loads' and policyname='account_loads_company_members_all') then
    create policy account_loads_company_members_all on public.account_loads for all
      using (
        public.has_global_role('SUPER_ADMIN', auth.uid())
        or exists (select 1 from public.user_company_roles ucr where ucr.user_id = auth.uid() and ucr.company_id = account_loads.company_id)
      )
      with check (
        public.has_global_role('SUPER_ADMIN', auth.uid())
        or exists (select 1 from public.user_company_roles ucr where ucr.user_id = auth.uid() and ucr.company_id = account_loads.company_id)
      );
  end if;
end $$;

-- RPC: create account load + journal entry
create or replace function public.create_account_load_operation(
  p_company_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_load_date date,
  p_origin text,
  p_notes text,
  p_currency text default 'TND',
  p_attachment_document_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_load_id uuid;
  v_entry_id uuid;
  v_counterpart_id uuid;
  v_ref text;
  v_desc text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be > 0';
  end if;
  if p_account_id is null then
    raise exception 'account_id is required';
  end if;

  v_ref := 'Charger compte';
  v_desc := coalesce(nullif(p_origin, ''), 'Encaissement autonome');

  insert into public.account_loads(
    company_id,
    user_id,
    account_id,
    amount,
    currency,
    load_date,
    origin,
    notes,
    attachment_document_id
  )
  values (
    p_company_id,
    auth.uid(),
    p_account_id,
    p_amount,
    coalesce(p_currency, 'TND'),
    coalesce(p_load_date, current_date),
    p_origin,
    p_notes,
    p_attachment_document_id
  )
  returning id into v_load_id;

  insert into public.journal_entries(
    user_id,
    company_id,
    entry_date,
    reference,
    description,
    created_by_user_id
  )
  values (
    auth.uid(),
    p_company_id,
    coalesce(p_load_date, current_date),
    v_ref,
    v_desc,
    auth.uid()
  )
  returning id into v_entry_id;

  update public.account_loads set journal_entry_id = v_entry_id where id = v_load_id;

  v_counterpart_id := public.ensure_company_account(
    p_company_id,
    '999-loads',
    'Compte de contrepartie chargements',
    'passif'
  );

  -- Charger compte: débit du compte (augmente le solde), crédit de la contrepartie
  insert into public.journal_lines(entry_id, account_id, debit, credit)
  values (v_entry_id, p_account_id, p_amount, 0);

  insert into public.journal_lines(entry_id, account_id, debit, credit)
  values (v_entry_id, v_counterpart_id, 0, p_amount);

  return v_load_id;
end;
$$;

commit;
