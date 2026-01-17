-- Ensure companies.legal_name exists (compat with older schema using companies.name).

begin;

alter table public.companies
  add column if not exists legal_name text;

-- Backfill legal_name from legacy name column when present.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'companies'
      and column_name = 'name'
  ) then
    execute 'update public.companies set legal_name = coalesce(legal_name, name) where legal_name is null';
  end if;
end $$;

commit;
