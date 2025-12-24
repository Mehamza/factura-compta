-- RPC: create payment and corresponding journal entry/lines atomically
-- Parameters mirror client RPC call; user identity is taken from auth.uid()
create or replace function public.create_payment_with_account(
  p_user_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_reference text,
  p_notes text,
  p_account_id uuid
)
returns void language plpgsql as $$
declare
  v_payment_id uuid;
  v_entry_id uuid;
  v_client_id uuid;
  v_counterpart_id uuid;
begin
  -- resolve client from invoice if provided
  if p_invoice_id is not null then
    select client_id into v_client_id from public.invoices where id = p_invoice_id;
  end if;

  -- insert payment (user_id uses auth.uid() to satisfy RLS)
  insert into public.payments(user_id, client_id, invoice_id, method_id, amount, paid_at, reference, notes, created_by_user_id)
  values (auth.uid(), v_client_id, p_invoice_id, null, p_amount, p_payment_date, p_reference, p_notes, auth.uid())
  returning id into v_payment_id;

  -- create journal entry for the payment
  insert into public.journal_entries(user_id, entry_date, reference, description, created_by_user_id)
  values (auth.uid(), p_payment_date, p_reference, 'Paiement', auth.uid())
  returning id into v_entry_id;

  -- ensure a user-level counterpart account exists (system payments account)
  select id into v_counterpart_id from public.accounts where user_id = auth.uid() and code = '999-payments' limit 1;
  if v_counterpart_id is null then
    insert into public.accounts(user_id, code, name, type) values (auth.uid(), '999-payments', 'Compte Paiements', 'liability')
    returning id into v_counterpart_id;
  end if;

  -- Debit bank account (asset increase)
  insert into public.journal_lines(entry_id, account_id, payment_id, debit, credit)
  values (v_entry_id, p_account_id, v_payment_id, p_amount, 0);

  -- Credit counterpart (link to invoice if present)
  insert into public.journal_lines(entry_id, account_id, payment_id, invoice_id, debit, credit)
  values (v_entry_id, v_counterpart_id, v_payment_id, p_invoice_id, 0, p_amount);

  return;
end;
$$;
