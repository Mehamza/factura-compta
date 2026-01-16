-- Defer journal balance validation until end of transaction.
-- The existing row-level AFTER trigger runs after each journal_lines insert,
-- which breaks multi-step inserts (e.g., expense creates 2 lines) because the
-- entry is temporarily unbalanced between statements.

begin;

-- Ensure function exists (should already exist)
-- public.ensure_balanced_entry()

drop trigger if exists trg_ensure_balanced on public.journal_lines;

-- Recreate as a DEFERRABLE constraint trigger so it fires at commit.
create constraint trigger trg_ensure_balanced
after insert or update or delete on public.journal_lines
deferrable initially deferred
for each row
execute function public.ensure_balanced_entry();

commit;
