-- RPCs Finance: création atomique paiement/dépense + écritures journal

begin;

-- Optional links to journal entries
alter table public.payments
  add column if not exists journal_entry_id uuid references public.journal_entries(id) on delete set null;

alter table public.expenses
  add column if not exists journal_entry_id uuid references public.journal_entries(id) on delete set null;

-- Helper: ensure a system account exists per company
create or replace function public.ensure_company_account(
  p_company_id uuid,
  p_code text,
  p_name text,
  p_type text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.accounts
  where company_id = p_company_id and code = p_code
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.accounts(company_id, user_id, code, name, type)
  values (p_company_id, auth.uid(), p_code, p_name, p_type)
  returning id into v_id;

  return v_id;
end;
$$;

-- Create payment (vente/achat) + journal entry + invoice payment fields recompute
create or replace function public.create_payment_operation(
  p_company_id uuid,
  p_payment_type text, -- 'vente' | 'achat'
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_account_id uuid,
  p_reference text default null,
  p_notes text default null,
  p_currency text default 'TND',
  p_attachment_document_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_entry_id uuid;
  v_client_id uuid;
  v_supplier_id uuid;
  v_counterpart_id uuid;
  v_invoice_company_id uuid;
  v_debit numeric;
  v_credit numeric;
  v_cp_debit numeric;
  v_cp_credit numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be > 0';
  end if;
  if p_payment_type is null or p_payment_type not in ('vente','achat') then
    raise exception 'payment_type must be vente or achat';
  end if;
  if p_account_id is null then
    raise exception 'account_id is required';
  end if;

  if p_invoice_id is not null then
    select company_id, client_id, supplier_id
      into v_invoice_company_id, v_client_id, v_supplier_id
    from public.invoices
    where id = p_invoice_id;

    if not found then
      raise exception 'invoice not found';
    end if;

    if v_invoice_company_id is not null and v_invoice_company_id <> p_company_id then
      raise exception 'invoice company mismatch';
    end if;

    if p_payment_type = 'vente' and v_client_id is null then
      raise exception 'vente payment requires invoice client_id';
    end if;

    if p_payment_type = 'achat' and v_supplier_id is null then
      raise exception 'achat payment requires invoice supplier_id';
    end if;
  end if;

  -- Insert payment
  insert into public.payments(
    user_id,
    company_id,
    invoice_id,
    client_id,
    supplier_id,
    amount,
    currency,
    paid_at,
    payment_date,
    payment_method,
    reference,
    notes,
    account_id,
    payment_type,
    attachment_document_id
  )
  values (
    auth.uid(),
    p_company_id,
    p_invoice_id,
    v_client_id,
    v_supplier_id,
    p_amount,
    p_currency,
    coalesce(p_payment_date, current_date),
    coalesce(p_payment_date, current_date),
    coalesce(p_payment_method, 'espèces'),
    p_reference,
    p_notes,
    p_account_id,
    p_payment_type,
    p_attachment_document_id
  )
  returning id into v_payment_id;

  -- Journal entry
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
    coalesce(p_payment_date, current_date),
    coalesce(p_reference, case when p_payment_type = 'vente' then 'Encaissement' else 'Décaissement' end),
    case when p_payment_type = 'vente' then 'Paiement vente' else 'Paiement achat' end,
    auth.uid()
  )
  returning id into v_entry_id;

  -- Link
  update public.payments set journal_entry_id = v_entry_id where id = v_payment_id;

  -- Counterpart account
  v_counterpart_id := public.ensure_company_account(
    p_company_id,
    '999-payments',
    'Compte de contrepartie paiements',
    'passif'
  );

  -- Debit/Credit rules for the compte (asset account):
  -- vente (encaissement): debit compte
  -- achat (décaissement): credit compte
  v_debit := case when p_payment_type = 'vente' then p_amount else 0 end;
  v_credit := case when p_payment_type = 'achat' then p_amount else 0 end;
  v_cp_debit := v_credit;
  v_cp_credit := v_debit;

  insert into public.journal_lines(entry_id, account_id, invoice_id, payment_id, debit, credit)
  values (v_entry_id, p_account_id, p_invoice_id, v_payment_id, v_debit, v_credit);

  insert into public.journal_lines(entry_id, account_id, invoice_id, payment_id, debit, credit)
  values (v_entry_id, v_counterpart_id, p_invoice_id, v_payment_id, v_cp_debit, v_cp_credit);

  -- Recompute invoice payment fields (total_paid, remaining_amount, payment_status)
  if p_invoice_id is not null then
    perform public.recompute_invoice_payment_fields(p_invoice_id);
  end if;

  return v_payment_id;
end;
$$;

-- Create expense + journal entry to decrease compte balance
create or replace function public.create_expense_operation(
  p_company_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_expense_date date,
  p_category text,
  p_description text,
  p_payment_method text,
  p_reference text default null,
  p_currency text default 'TND',
  p_attachment_document_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense_id uuid;
  v_entry_id uuid;
  v_expense_account_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be > 0';
  end if;
  if p_account_id is null then
    raise exception 'account_id is required';
  end if;

  insert into public.expenses(
    company_id,
    user_id,
    account_id,
    amount,
    currency,
    expense_date,
    category,
    description,
    payment_method,
    reference,
    attachment_document_id
  )
  values (
    p_company_id,
    auth.uid(),
    p_account_id,
    p_amount,
    p_currency,
    coalesce(p_expense_date, current_date),
    p_category,
    p_description,
    coalesce(p_payment_method, 'espèces'),
    p_reference,
    p_attachment_document_id
  )
  returning id into v_expense_id;

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
    coalesce(p_expense_date, current_date),
    coalesce(p_reference, 'Dépense'),
    coalesce(p_description, 'Dépense'),
    auth.uid()
  )
  returning id into v_entry_id;

  update public.expenses set journal_entry_id = v_entry_id where id = v_expense_id;

  v_expense_account_id := public.ensure_company_account(
    p_company_id,
    '600-expenses',
    'Charges',
    'charge'
  );

  -- Dépense: crédit du compte (baisse), débit de charges
  insert into public.journal_lines(entry_id, account_id, debit, credit)
  values (v_entry_id, v_expense_account_id, p_amount, 0);

  insert into public.journal_lines(entry_id, account_id, debit, credit)
  values (v_entry_id, p_account_id, 0, p_amount);

  return v_expense_id;
end;
$$;

commit;
