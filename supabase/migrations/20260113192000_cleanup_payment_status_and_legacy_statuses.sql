-- Cleanup: make invoices.status the single source of truth for payment progression
-- and remove legacy payment_status plumbing + purchase_quote policies.

begin;

-- 1) Rewrite recompute function to avoid invoices.payment_status entirely.
create or replace function public.recompute_invoice_payment_fields(p_invoice_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_total numeric;
  v_total_paid numeric;
  v_remaining numeric;
  v_status text;
  v_due_date date;
  v_document_kind text;
begin
  select total_amount, due_date, document_kind
    into v_total, v_due_date, v_document_kind
  from public.invoices
  where id = p_invoice_id;

  if not found then
    return;
  end if;

  select coalesce(sum(amount), 0)
    into v_total_paid
  from public.payments
  where invoice_id = p_invoice_id;

  v_remaining := coalesce(v_total, 0) - v_total_paid;

  if coalesce(v_total, 0) <= 0 then
    v_status := 'paid';
  elsif v_total_paid <= 0 then
    v_status := 'unpaid';
  elsif v_remaining > 0 then
    if v_due_date is not null and v_due_date < current_date then
      v_status := 'overdue';
    else
      v_status := 'partial';
    end if;
  else
    v_status := 'paid';
  end if;

  update public.invoices
  set
    total_paid = v_total_paid,
    remaining_amount = greatest(v_remaining, 0),
    status = case
      when v_document_kind in ('facture','facture_achat','facture_credit','facture_payee','facture_credit_achat') then v_status
      else status
    end
  where id = p_invoice_id;
end;
$$;

-- 2) Drop legacy functions/triggers from older status models.
drop trigger if exists trg_invoices_recompute_payment_status on public.invoices;
drop function if exists public.trg_invoices_recompute_payment_status();

drop function if exists public.recompute_invoice_payment_status(p_invoice_id uuid);
drop function if exists public.trg_payment_update_invoice_status();
drop function if exists public.update_invoice_payment_status(p_invoice_id uuid);

-- 3) Remove unused invoices.payment_status column + constraint.
alter table public.invoices drop constraint if exists invoices_payment_status_check;
alter table public.invoices drop column if exists payment_status;

-- 4) Update RLS policies that referenced the removed legacy status values.
-- Only drafts are editable for regular users; admin/accountant can update anything.
drop policy if exists "Users can update their own invoices" on public.invoices;
create policy "Users can update their own invoices" on public.invoices
  for update
  using (
    (user_id = auth.uid() and status = 'draft')
    or public.has_role(auth.uid(), 'admin'::app_role)
    or public.has_role(auth.uid(), 'accountant'::app_role)
  );

-- Payments can reference invoices only when they are payable.
drop policy if exists pay_insert on public.payments;
create policy pay_insert on public.payments
  for insert
  with check (
    user_id = auth.uid()
    and (
      invoice_id is null
      or exists (
        select 1
        from public.invoices i
        where i.id = invoice_id
          and i.status in ('unpaid','partial','overdue')
      )
    )
  );

-- Journal lines can reference only non-draft/non-cancelled documents.
drop policy if exists "Users can create journal lines" on public.journal_lines;
create policy "Users can create journal lines" on public.journal_lines
  for insert
  with check (
    exists (
      select 1
      from public.journal_entries je
      where je.id = journal_lines.entry_id
        and je.user_id = auth.uid()
    )
    and (
      invoice_id is null
      or exists (
        select 1
        from public.invoices i
        where i.id = invoice_id
          and i.status <> 'draft'
          and i.status <> 'cancelled'
      )
    )
  );

commit;
