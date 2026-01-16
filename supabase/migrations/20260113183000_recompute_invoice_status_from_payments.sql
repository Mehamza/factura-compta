-- Keep invoice payment fields updated and also sync `invoices.status` for invoice document kinds.

begin;

create or replace function public.recompute_invoice_payment_fields(p_invoice_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_total numeric;
  v_total_paid numeric;
  v_remaining numeric;
  v_payment_status text;
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
    v_payment_status := 'paid';
  elsif v_total_paid <= 0 then
    v_payment_status := 'unpaid';
  elsif v_remaining > 0 then
    if v_due_date is not null and v_due_date < current_date then
      v_payment_status := 'overdue';
    else
      v_payment_status := 'partial';
    end if;
  else
    v_payment_status := 'paid';
  end if;

  update public.invoices
  set
    total_paid = v_total_paid,
    remaining_amount = greatest(v_remaining, 0),
    payment_status = v_payment_status,
    status = case
      when v_document_kind in ('facture','facture_achat','facture_credit','facture_payee','facture_credit_achat') then v_payment_status
      else status
    end
  where id = p_invoice_id;
end;
$$;

commit;
