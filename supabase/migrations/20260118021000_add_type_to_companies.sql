-- Ensure companies.type exists (used by Settings wizard)
-- Values: 'personne_physique' | 'personne_morale'

begin;

alter table public.companies
  add column if not exists type text;

-- Backfill + default
update public.companies
set type = coalesce(type, 'personne_physique')
where type is null;

alter table public.companies
  alter column type set default 'personne_physique';

commit;
