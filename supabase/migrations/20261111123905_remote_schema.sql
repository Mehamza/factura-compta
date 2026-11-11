
  create policy "allow insert for authenticated"
  on "public"."companies"
  as permissive
  for insert
  to authenticated
with check (true);



