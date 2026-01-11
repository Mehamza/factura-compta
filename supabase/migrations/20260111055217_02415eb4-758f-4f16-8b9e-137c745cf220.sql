-- MIGRATION: Correction search_path sur toutes les fonctions DB
-- Cela évite les attaques par injection de schéma

-- 1. is_company_disabled
CREATE OR REPLACE FUNCTION public.is_company_disabled(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT 
    NOT active 
    OR (disabled_until IS NOT NULL AND disabled_until > now())
  FROM public.companies 
  WHERE id = p_company_id
$$;

-- 2. invoice_outstanding
CREATE OR REPLACE FUNCTION public.invoice_outstanding(p_invoice_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (i.total - COALESCE((SELECT SUM(p.amount) FROM public.payments p WHERE p.invoice_id = i.id), 0))
  FROM public.invoices i WHERE i.id = p_invoice_id;
$$;

-- 3. refresh_invoice_status
CREATE OR REPLACE FUNCTION public.refresh_invoice_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.invoices i
  SET status = CASE
    WHEN public.invoice_outstanding(i.id) <= 0 THEN 'paid'
    WHEN i.due_date < now()::date THEN 'overdue'
    ELSE i.status
  END
  WHERE i.id = COALESCE(new.invoice_id, old.invoice_id);
  RETURN NULL;
END;
$$;

-- 4. ensure_balanced_entry
CREATE OR REPLACE FUNCTION public.ensure_balanced_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE 
  s_debit numeric; 
  s_credit numeric; 
BEGIN
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
  INTO s_debit, s_credit 
  FROM public.journal_lines 
  WHERE entry_id = COALESCE(new.entry_id, old.entry_id);
  
  IF s_debit <> s_credit THEN
    RAISE EXCEPTION 'Journal entry not balanced: debit % credit %', s_debit, s_credit;
  END IF;
  RETURN NULL;
END;
$$;

-- 5. has_global_role
CREATE OR REPLACE FUNCTION public.has_global_role(p_role text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_global_roles ugr
    WHERE ugr.user_id = p_user_id
      AND lower(ugr.role) = lower(p_role)
  );
$$;

-- 6. has_company_role (version text)
CREATE OR REPLACE FUNCTION public.has_company_role(p_role text, p_user_id uuid, p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_company_roles ucr
    WHERE ucr.user_id = p_user_id 
      AND ucr.company_id = p_company_id 
      AND lower(ucr.role) = lower(p_role)
  );
$$;

-- 7. _get_default_company_id
CREATE OR REPLACE FUNCTION public._get_default_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.companies ORDER BY created_at LIMIT 1
$$;

-- 8. convert_purchase_quote_to_invoice
CREATE OR REPLACE FUNCTION public.convert_purchase_quote_to_invoice(p_invoice_id uuid)
RETURNS TABLE(id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  -- ensure invoice exists and is a purchase_quote
  SELECT i.status INTO v_status FROM public.invoices i WHERE i.id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  IF v_status <> 'purchase_quote' THEN
    RAISE EXCEPTION 'Invoice is not a purchase quote';
  END IF;

  -- authorize
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'accountant'::app_role)) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- update status to sent (or 'sent' as validated)
  UPDATE public.invoices SET status = 'sent', updated_at = now() WHERE invoices.id = p_invoice_id;

  RETURN QUERY SELECT inv.id, inv.status FROM public.invoices inv WHERE inv.id = p_invoice_id;
END;
$$;

-- 9. trg_invoice_items_recompute_totals
CREATE OR REPLACE FUNCTION public.trg_invoice_items_recompute_totals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
BEGIN
  v_invoice_id := CASE WHEN tg_op = 'DELETE' THEN old.invoice_id ELSE new.invoice_id END;
  PERFORM public.recompute_invoice_totals(v_invoice_id);
  RETURN NULL;
END;
$$;

-- 10. trg_invoices_recompute_on_change
CREATE OR REPLACE FUNCTION public.trg_invoices_recompute_on_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_invoice_totals(new.id);
  RETURN new;
END;
$$;

-- 11. create_payment_with_account
CREATE OR REPLACE FUNCTION public.create_payment_with_account(
  p_user_id uuid, 
  p_invoice_id uuid, 
  p_amount numeric, 
  p_payment_date date, 
  p_payment_method text, 
  p_reference text, 
  p_notes text, 
  p_account_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id uuid;
  v_entry_id uuid;
  v_client_id uuid;
  v_counterpart_id uuid;
BEGIN
  -- resolve client from invoice if provided
  IF p_invoice_id IS NOT NULL THEN
    SELECT client_id INTO v_client_id FROM public.invoices WHERE id = p_invoice_id;
  END IF;

  -- insert payment (user_id uses auth.uid() to satisfy RLS)
  INSERT INTO public.payments(user_id, client_id, invoice_id, method_id, amount, paid_at, reference, notes, created_by_user_id)
  VALUES (auth.uid(), v_client_id, p_invoice_id, null, p_amount, p_payment_date, p_reference, p_notes, auth.uid())
  RETURNING id INTO v_payment_id;

  -- create journal entry for the payment
  INSERT INTO public.journal_entries(user_id, entry_date, reference, description, created_by_user_id)
  VALUES (auth.uid(), p_payment_date, p_reference, 'Paiement', auth.uid())
  RETURNING id INTO v_entry_id;

  -- ensure a user-level counterpart account exists (system payments account)
  SELECT id INTO v_counterpart_id FROM public.accounts WHERE user_id = auth.uid() AND code = '999-payments' LIMIT 1;
  IF v_counterpart_id IS NULL THEN
    INSERT INTO public.accounts(user_id, code, name, type) VALUES (auth.uid(), '999-payments', 'Compte Paiements', 'liability')
    RETURNING id INTO v_counterpart_id;
  END IF;

  -- Debit bank account (asset increase)
  INSERT INTO public.journal_lines(entry_id, account_id, payment_id, debit, credit)
  VALUES (v_entry_id, p_account_id, v_payment_id, p_amount, 0);

  -- Credit counterpart (link to invoice if present)
  INSERT INTO public.journal_lines(entry_id, account_id, payment_id, invoice_id, debit, credit)
  VALUES (v_entry_id, v_counterpart_id, v_payment_id, p_invoice_id, 0, p_amount);

  RETURN;
END;
$$;