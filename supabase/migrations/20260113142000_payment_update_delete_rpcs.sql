-- Update/Delete payment operations atomically (payment + journal + invoice recompute)

begin;

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
  p_attachment_document_id uuid default null
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

  select invoice_id, journal_entry_id into v_old_invoice_id, v_entry_id
  from public.payments
  where id = p_payment_id;

  if not found then
    raise exception 'payment not found';
  end if;

  update public.payments
  set invoice_id = p_invoice_id,
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
      (select company_id from public.payments where id = p_payment_id),
      '999-payments',
      'Compte de contrepartie paiements',
      'passif'
    );

    v_debit := case when p_payment_type = 'vente' then p_amount else 0 end;
    v_credit := case when p_payment_type = 'achat' then p_amount else 0 end;
    v_cp_debit := v_credit;
    v_cp_credit := v_debit;

    -- Rewrite journal lines for this payment/entry
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

create or replace function public.delete_payment_operation(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_entry_id uuid;
begin
  select invoice_id, journal_entry_id into v_invoice_id, v_entry_id
  from public.payments
  where id = p_payment_id;

  if not found then
    return;
  end if;

  -- Remove journal
  if v_entry_id is not null then
    delete from public.journal_lines where entry_id = v_entry_id;
    delete from public.journal_entries where id = v_entry_id;
  end if;

  delete from public.payments where id = p_payment_id;

  if v_invoice_id is not null then
    perform public.recompute_invoice_payment_fields(v_invoice_id);
  end if;
end;
$$;

commit;
