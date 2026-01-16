-- Per-document-kind numbering sequences (per company)
-- Goal: each document type (facture, devis, BL, etc.) has its own series within each company.

begin;

create table if not exists public.document_number_sequences (
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null,
  next_number bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, kind)
);

-- Trigger updated_at
drop trigger if exists update_document_number_sequences_updated_at on public.document_number_sequences;
create trigger update_document_number_sequences_updated_at
before update on public.document_number_sequences
for each row execute function public.update_updated_at_column();

-- Seed sequences from existing invoices, best-effort: take trailing numeric suffix
insert into public.document_number_sequences(company_id, kind, next_number)
select
  i.company_id,
  i.document_kind as kind,
  coalesce(max((regexp_match(i.invoice_number, '([0-9]+)$'))[1]::bigint), 0) + 1 as next_number
from public.invoices i
where i.company_id is not null
  and i.document_kind is not null
group by i.company_id, i.document_kind
on conflict (company_id, kind)
do update set next_number = greatest(public.document_number_sequences.next_number, excluded.next_number);

-- RLS (mostly for admin visibility; numbering is handled via SECURITY DEFINER RPC)
alter table public.document_number_sequences enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='document_number_sequences' and policyname='document_number_sequences_super_admin_all'
  ) then
    create policy document_number_sequences_super_admin_all on public.document_number_sequences for all
      using (public.has_global_role('SUPER_ADMIN', auth.uid()))
      with check (public.has_global_role('SUPER_ADMIN', auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='document_number_sequences' and policyname='document_number_sequences_company_members_select'
  ) then
    create policy document_number_sequences_company_members_select on public.document_number_sequences for select
      using (
        public.has_global_role('SUPER_ADMIN', auth.uid())
        or exists (
          select 1
          from public.user_company_roles ucr
          where ucr.user_id = auth.uid() and ucr.company_id = document_number_sequences.company_id
        )
      );
  end if;
end $$;

-- Atomic number generator per company + kind
create or replace function public.next_document_number(
  p_company_id uuid,
  p_kind text,
  p_prefix text,
  p_format text default '{prefix}-{year}-{number}',
  p_padding int default 4,
  p_issue_date date default current_date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
  v_year text;
  v_num_str text;
  v_result text;
begin
  if p_company_id is null then
    raise exception 'company_id is required';
  end if;
  if p_kind is null or btrim(p_kind) = '' then
    raise exception 'kind is required';
  end if;
  if p_prefix is null then
    p_prefix := '';
  end if;
  if p_format is null or btrim(p_format) = '' then
    p_format := '{prefix}-{year}-{number}';
  end if;
  if p_padding is null or p_padding < 0 then
    p_padding := 4;
  end if;

  insert into public.document_number_sequences(company_id, kind, next_number)
  values (p_company_id, p_kind, 1)
  on conflict (company_id, kind) do nothing;

  select next_number into v_next
  from public.document_number_sequences
  where company_id = p_company_id and kind = p_kind
  for update;

  v_year := extract(year from coalesce(p_issue_date, current_date))::text;
  v_num_str := lpad(v_next::text, p_padding, '0');

  v_result := replace(replace(replace(p_format, '{prefix}', p_prefix), '{year}', v_year), '{number}', v_num_str);

  update public.document_number_sequences
  set next_number = v_next + 1,
      updated_at = now()
  where company_id = p_company_id and kind = p_kind;

  return v_result;
end;
$$;

commit;
