-- Allow standalone payments (no invoice) by selecting client/supplier

begin;

-- Replace create_payment_operation with tier-aware version.
-- We always pass p_client_id/p_supplier_id (nullable) from the frontend.
drop function if exists public.create_payment_operation(
  uuid,
  text,
  uuid,
  numeric,
  date,
  text,
  uuid,
  text,
  text,
  text,
  uuid
);

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
  p_attachment_document_id uuid default null,
  p_client_id uuid default null,
  p_supplier_id uuid default null
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

  -- Resolve tier from invoice if linked, otherwise use provided tier.
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
  else
    v_client_id := p_client_id;
    v_supplier_id := p_supplier_id;
  end if;

  if p_payment_type = 'vente' then
    if v_client_id is null then
      raise exception 'vente payment requires client_id or invoice_id';
    end if;
    v_supplier_id := null;
  elsif p_payment_type = 'achat' then
    if v_supplier_id is null then
      raise exception 'achat payment requires supplier_id or invoice_id';
    end if;
    v_client_id := null;
  end if;

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

  update public.payments set journal_entry_id = v_entry_id where id = v_payment_id;

  v_counterpart_id := public.ensure_company_account(
    p_company_id,
    '999-payments',
    'Compte de contrepartie paiements',
    'liability'
  );

  v_debit := case when p_payment_type = 'vente' then p_amount else 0 end;
  v_credit := case when p_payment_type = 'achat' then p_amount else 0 end;
  v_cp_debit := v_credit;
  v_cp_credit := v_debit;

  insert into public.journal_lines(entry_id, account_id, invoice_id, payment_id, debit, credit)
  values (v_entry_id, p_account_id, p_invoice_id, v_payment_id, v_debit, v_credit);

  insert into public.journal_lines(entry_id, account_id, invoice_id, payment_id, debit, credit)
  values (v_entry_id, v_counterpart_id, p_invoice_id, v_payment_id, v_cp_debit, v_cp_credit);

  if p_invoice_id is not null then
    perform public.recompute_invoice_payment_fields(p_invoice_id);
  end if;

  return v_payment_id;
end;
$$;

-- Replace update_payment_operation with tier-aware version.
drop function if exists public.update_payment_operation(
  uuid,
  text,
  uuid,
  numeric,
  date,
  text,
  uuid,
  text,
  text,
  text,
  uuid
);

create or replace function public.update_payment_operation(
  p_payment_id uuid,
  p_payment_type text, -- 'vente' | 'achat'
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_account_id uuid,
  p_reference text default null,
  p_notes text default null,
  p_currency text default 'TND',
  p_attachment_document_id uuid default null,
  p_client_id uuid default null,
  p_supplier_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_invoice_id uuid;
  v_entry_id uuid;
  v_counterpart_id uuid;
  v_company_id uuid;
  v_client_id uuid;
  v_supplier_id uuid;
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

  select invoice_id, journal_entry_id, company_id
    into v_old_invoice_id, v_entry_id, v_company_id
  from public.payments
  where id = p_payment_id;

  if not found then
    raise exception 'payment not found';
  end if;

  if p_invoice_id is not null then
    select company_id, client_id, supplier_id
      into v_invoice_company_id, v_client_id, v_supplier_id
    from public.invoices
    where id = p_invoice_id;

    if not found then
      raise exception 'invoice not found';
    end if;

    if v_invoice_company_id is not null and v_invoice_company_id <> v_company_id then
      raise exception 'invoice company mismatch';
    end if;
  else
    v_client_id := p_client_id;
    v_supplier_id := p_supplier_id;
  end if;

  if p_payment_type = 'vente' then
    if v_client_id is null then
      raise exception 'vente payment requires client_id or invoice_id';
    end if;
    v_supplier_id := null;
  elsif p_payment_type = 'achat' then
    if v_supplier_id is null then
      raise exception 'achat payment requires supplier_id or invoice_id';
    end if;
    v_client_id := null;
  end if;

  update public.payments
  set invoice_id = p_invoice_id,
      client_id = v_client_id,
      supplier_id = v_supplier_id,
      amount = p_amount,
      currency = p_currency,
      paid_at = coalesce(p_payment_date, current_date),
      payment_date = coalesce(p_payment_date, current_date),
      payment_method = coalesce(p_payment_method, payment_method),
      reference = p_reference,
      notes = p_notes,
      account_id = p_account_id,
      payment_type = p_payment_type,
      attachment_document_id = p_attachment_document_id
  where id = p_payment_id;

  if v_entry_id is not null then
    update public.journal_entries
    set entry_date = coalesce(p_payment_date, current_date),
        reference = coalesce(p_reference, reference),
        description = case when p_payment_type = 'vente' then 'Paiement vente' else 'Paiement achat' end
    where id = v_entry_id;

    v_counterpart_id := public.ensure_company_account(
      v_company_id,
      '999-payments',
      'Compte de contrepartie paiements',
      'liability'
    );

    v_debit := case when p_payment_type = 'vente' then p_amount else 0 end;
    v_credit := case when p_payment_type = 'achat' then p_amount else 0 end;
    v_cp_debit := v_credit;
    v_cp_credit := v_debit;

    delete from public.journal_lines where entry_id = v_entry_id and payment_id = p_payment_id;

    insert into public.journal_lines(entry_id, account_id, invoice_id, payment_id, debit, credit)
    values (v_entry_id, p_account_id, p_invoice_id, p_payment_id, v_debit, v_credit);

    insert into public.journal_lines(entry_id, account_id, invoice_id, payment_id, debit, credit)
    values (v_entry_id, v_counterpart_id, p_invoice_id, p_payment_id, v_cp_debit, v_cp_credit);
  end if;

  if v_old_invoice_id is not null then
    perform public.recompute_invoice_payment_fields(v_old_invoice_id);
  end if;
  if p_invoice_id is not null then
    perform public.recompute_invoice_payment_fields(p_invoice_id);
  end if;
end;
$$;

commit;
