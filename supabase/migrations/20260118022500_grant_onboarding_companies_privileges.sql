-- Some projects miss the default GRANTs for PostgREST roles.
-- Ensure authenticated users can run the onboarding flow:
-- - insert into companies
-- - update companies
-- - insert into company_users (to link themselves)

begin;

grant usage on schema public to authenticated;

grant select, insert, update on table public.companies to authenticated;
grant select, insert on table public.company_users to authenticated;

commit;
