-- Support {month} placeholder in document numbering format

begin;

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
  v_month text;
  v_num_str text;
  v_result text;
  v_effective_date date;
begin
  if p_company_id is null then
    raise exception 'company_id is required';
  end if;
  if p_kind is null or btrim(p_kind) = '' then
    raise exception 'kind is required';
  end if;

  v_effective_date := coalesce(p_issue_date, current_date);

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

  v_year := extract(year from v_effective_date)::text;
  v_month := lpad(extract(month from v_effective_date)::int::text, 2, '0');
  v_num_str := lpad(v_next::text, p_padding, '0');

  v_result := p_format;
  v_result := replace(v_result, '{prefix}', p_prefix);
  v_result := replace(v_result, '{year}', v_year);
  v_result := replace(v_result, '{month}', v_month);
  v_result := replace(v_result, '{number}', v_num_str);

  update public.document_number_sequences
  set next_number = v_next + 1,
      updated_at = now()
  where company_id = p_company_id and kind = p_kind;

  return v_result;
end;
$$;

commit;
