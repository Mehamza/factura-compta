-- RPC to convert a purchase quote into a regular invoice (mark as sent)
-- Only users with admin or accountant role can perform the conversion
create or replace function public.convert_purchase_quote_to_invoice(p_invoice_id uuid)
returns table(id uuid, status text) language plpgsql as $$
declare
  v_status text;
begin
  -- ensure invoice exists and is a purchase_quote
  select status into v_status from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'Invoice not found';
  end if;
  if v_status <> 'purchase_quote' then
    raise exception 'Invoice is not a purchase quote';
  end if;

  -- authorize
  if not (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'accountant'::app_role)) then
    raise exception 'Permission denied';
  end if;

  -- update status to sent (or 'sent' as validated)
  update public.invoices set status = 'sent', updated_at = now() where id = p_invoice_id;

  return query select id, status from public.invoices where id = p_invoice_id;
end;
$$;
