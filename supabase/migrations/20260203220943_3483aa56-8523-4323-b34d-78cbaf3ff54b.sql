-- =============================================
-- SECURITY FIX: Add company authorization checks to finance RPC functions
-- and restrict payments table access to admin/accountant roles
-- =============================================

-- 1. Drop and recreate payments SELECT policy to restrict access by role
DROP POLICY IF EXISTS "pay_select" ON public.payments;

CREATE POLICY "payments_select_by_role" ON public.payments
FOR SELECT USING (
  -- Super admins can see all
  public.has_global_role('SUPER_ADMIN', auth.uid())
  OR (
    payments.company_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.company_id = payments.company_id
        AND cu.role IN ('company_admin', 'comptable', 'gerant')
    )
  )
);

-- 2. Fix create_payment_operation - add authorization check
CREATE OR REPLACE FUNCTION public.create_payment_operation(
  p_company_id uuid,
  p_payment_type text,
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_account_id uuid,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_currency text DEFAULT 'TND',
  p_attachment_document_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
  v_user_has_access boolean := false;
BEGIN
  -- =========================================
  -- SECURITY CHECK: Verify caller has access to the company
  -- =========================================
  SELECT EXISTS(
    SELECT 1 FROM public.company_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.company_id = p_company_id
      AND cu.role IN ('company_admin', 'comptable', 'gerant', 'caissier')
  ) INTO v_user_has_access;
  
  IF NOT v_user_has_access AND NOT public.has_global_role('SUPER_ADMIN', auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: not a member of company';
  END IF;
  -- =========================================

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be > 0';
  END IF;
  IF p_payment_type IS NULL OR p_payment_type NOT IN ('vente','achat') THEN
    RAISE EXCEPTION 'payment_type must be vente or achat';
  END IF;
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'account_id is required';
  END IF;

  -- Resolve tier from invoice if linked
  IF p_invoice_id IS NOT NULL THEN
    SELECT company_id, client_id, supplier_id
      INTO v_invoice_company_id, v_client_id, v_supplier_id
    FROM public.invoices
    WHERE id = p_invoice_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invoice not found';
    END IF;

    IF v_invoice_company_id IS NOT NULL AND v_invoice_company_id <> p_company_id THEN
      RAISE EXCEPTION 'invoice company mismatch';
    END IF;
  ELSE
    v_client_id := p_client_id;
    v_supplier_id := p_supplier_id;
  END IF;

  IF p_payment_type = 'vente' THEN
    IF v_client_id IS NULL THEN
      RAISE EXCEPTION 'vente payment requires client_id or invoice_id';
    END IF;
    v_supplier_id := NULL;
  ELSIF p_payment_type = 'achat' THEN
    IF v_supplier_id IS NULL THEN
      RAISE EXCEPTION 'achat payment requires supplier_id or invoice_id';
    END IF;
    v_client_id := NULL;
  END IF;

  INSERT INTO public.payments(
    user_id, company_id, invoice_id, client_id, supplier_id,
    amount, currency, paid_at, payment_date, payment_method,
    reference, notes, account_id, payment_type, attachment_document_id
  )
  VALUES (
    auth.uid(), p_company_id, p_invoice_id, v_client_id, v_supplier_id,
    p_amount, p_currency, COALESCE(p_payment_date, current_date),
    COALESCE(p_payment_date, current_date), COALESCE(p_payment_method, 'espèces'),
    p_reference, p_notes, p_account_id, p_payment_type, p_attachment_document_id
  )
  RETURNING id INTO v_payment_id;

  INSERT INTO public.journal_entries(
    user_id, company_id, entry_date, reference, description, created_by_user_id
  )
  VALUES (
    auth.uid(), p_company_id, COALESCE(p_payment_date, current_date),
    COALESCE(p_reference, CASE WHEN p_payment_type = 'vente' THEN 'Encaissement' ELSE 'Décaissement' END),
    CASE WHEN p_payment_type = 'vente' THEN 'Paiement vente' ELSE 'Paiement achat' END,
    auth.uid()
  )
  RETURNING id INTO v_entry_id;

  UPDATE public.payments SET journal_entry_id = v_entry_id WHERE id = v_payment_id;

  v_counterpart_id := public.ensure_company_account(
    p_company_id, '999-payments', 'Compte de contrepartie paiements', 'liability'
  );

  v_debit := CASE WHEN p_payment_type = 'vente' THEN p_amount ELSE 0 END;
  v_credit := CASE WHEN p_payment_type = 'achat' THEN p_amount ELSE 0 END;
  v_cp_debit := v_credit;
  v_cp_credit := v_debit;

  INSERT INTO public.journal_lines(entry_id, account_id, invoice_id, payment_id, debit, credit)
  VALUES (v_entry_id, p_account_id, p_invoice_id, v_payment_id, v_debit, v_credit);

  INSERT INTO public.journal_lines(entry_id, account_id, invoice_id, payment_id, debit, credit)
  VALUES (v_entry_id, v_counterpart_id, p_invoice_id, v_payment_id, v_cp_debit, v_cp_credit);

  IF p_invoice_id IS NOT NULL THEN
    PERFORM public.recompute_invoice_payment_fields(p_invoice_id);
  END IF;

  RETURN v_payment_id;
END;
$$;

-- 3. Fix update_payment_operation - add authorization check
CREATE OR REPLACE FUNCTION public.update_payment_operation(
  p_payment_id uuid,
  p_payment_type text,
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_account_id uuid,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_currency text DEFAULT 'TND',
  p_attachment_document_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
  v_user_has_access boolean := false;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be > 0';
  END IF;
  IF p_payment_type IS NULL OR p_payment_type NOT IN ('vente','achat') THEN
    RAISE EXCEPTION 'payment_type must be vente or achat';
  END IF;

  SELECT invoice_id, journal_entry_id, company_id
    INTO v_old_invoice_id, v_entry_id, v_company_id
  FROM public.payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found';
  END IF;

  -- =========================================
  -- SECURITY CHECK: Verify caller has access to this payment's company
  -- =========================================
  SELECT EXISTS(
    SELECT 1 FROM public.company_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.company_id = v_company_id
      AND cu.role IN ('company_admin', 'comptable', 'gerant')
  ) INTO v_user_has_access;
  
  IF NOT v_user_has_access AND NOT public.has_global_role('SUPER_ADMIN', auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: insufficient permissions';
  END IF;
  -- =========================================

  IF p_invoice_id IS NOT NULL THEN
    SELECT company_id, client_id, supplier_id
      INTO v_invoice_company_id, v_client_id, v_supplier_id
    FROM public.invoices
    WHERE id = p_invoice_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invoice not found';
    END IF;

    IF v_invoice_company_id IS NOT NULL AND v_invoice_company_id <> v_company_id THEN
      RAISE EXCEPTION 'invoice company mismatch';
    END IF;
  ELSE
    v_client_id := p_client_id;
    v_supplier_id := p_supplier_id;
  END IF;

  IF p_payment_type = 'vente' THEN
    IF v_client_id IS NULL THEN
      RAISE EXCEPTION 'vente payment requires client_id or invoice_id';
    END IF;
    v_supplier_id := NULL;
  ELSIF p_payment_type = 'achat' THEN
    IF v_supplier_id IS NULL THEN
      RAISE EXCEPTION 'achat payment requires supplier_id or invoice_id';
    END IF;
    v_client_id := NULL;
  END IF;

  UPDATE public.payments
  SET invoice_id = p_invoice_id, client_id = v_client_id, supplier_id = v_supplier_id,
      amount = p_amount, currency = p_currency,
      paid_at = COALESCE(p_payment_date, current_date),
      payment_date = COALESCE(p_payment_date, current_date),
      payment_method = COALESCE(p_payment_method, payment_method),
      reference = p_reference, notes = p_notes, account_id = p_account_id,
      payment_type = p_payment_type, attachment_document_id = p_attachment_document_id
  WHERE id = p_payment_id;

  IF v_entry_id IS NOT NULL THEN
    UPDATE public.journal_entries
    SET entry_date = COALESCE(p_payment_date, current_date),
        reference = COALESCE(p_reference, reference),
        description = CASE WHEN p_payment_type = 'vente' THEN 'Paiement vente' ELSE 'Paiement achat' END
    WHERE id = v_entry_id;

    v_counterpart_id := public.ensure_company_account(
      v_company_id, '999-payments', 'Compte de contrepartie paiements', 'liability'
    );

    v_debit := CASE WHEN p_payment_type = 'vente' THEN p_amount ELSE 0 END;
    v_credit := CASE WHEN p_payment_type = 'achat' THEN p_amount ELSE 0 END;
    v_cp_debit := v_credit;
    v_cp_credit := v_debit;

    DELETE FROM public.journal_lines WHERE entry_id = v_entry_id AND payment_id = p_payment_id;

    INSERT INTO public.journal_lines(entry_id, account_id, invoice_id, payment_id, debit, credit)
    VALUES (v_entry_id, p_account_id, p_invoice_id, p_payment_id, v_debit, v_credit);

    INSERT INTO public.journal_lines(entry_id, account_id, invoice_id, payment_id, debit, credit)
    VALUES (v_entry_id, v_counterpart_id, p_invoice_id, p_payment_id, v_cp_debit, v_cp_credit);
  END IF;

  IF v_old_invoice_id IS NOT NULL THEN
    PERFORM public.recompute_invoice_payment_fields(v_old_invoice_id);
  END IF;
  IF p_invoice_id IS NOT NULL THEN
    PERFORM public.recompute_invoice_payment_fields(p_invoice_id);
  END IF;
END;
$$;

-- 4. Fix delete_payment_operation - add authorization check
CREATE OR REPLACE FUNCTION public.delete_payment_operation(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_entry_id uuid;
  v_company_id uuid;
  v_user_has_access boolean := false;
BEGIN
  SELECT invoice_id, journal_entry_id, company_id 
    INTO v_invoice_id, v_entry_id, v_company_id
  FROM public.payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- =========================================
  -- SECURITY CHECK: Verify caller has access to this payment's company
  -- =========================================
  SELECT EXISTS(
    SELECT 1 FROM public.company_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.company_id = v_company_id
      AND cu.role IN ('company_admin', 'comptable')
  ) INTO v_user_has_access;
  
  IF NOT v_user_has_access AND NOT public.has_global_role('SUPER_ADMIN', auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: insufficient permissions';
  END IF;
  -- =========================================

  IF v_entry_id IS NOT NULL THEN
    DELETE FROM public.journal_lines WHERE entry_id = v_entry_id;
    DELETE FROM public.journal_entries WHERE id = v_entry_id;
  END IF;

  DELETE FROM public.payments WHERE id = p_payment_id;

  IF v_invoice_id IS NOT NULL THEN
    PERFORM public.recompute_invoice_payment_fields(v_invoice_id);
  END IF;
END;
$$;

-- 5. Fix create_expense_operation - add authorization check
CREATE OR REPLACE FUNCTION public.create_expense_operation(
  p_company_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_expense_date date,
  p_category text,
  p_description text,
  p_payment_method text,
  p_reference text DEFAULT NULL,
  p_currency text DEFAULT 'TND',
  p_attachment_document_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense_id uuid;
  v_entry_id uuid;
  v_expense_account_id uuid;
  v_user_has_access boolean := false;
BEGIN
  -- =========================================
  -- SECURITY CHECK: Verify caller has access to the company
  -- =========================================
  SELECT EXISTS(
    SELECT 1 FROM public.company_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.company_id = p_company_id
      AND cu.role IN ('company_admin', 'comptable', 'gerant')
  ) INTO v_user_has_access;
  
  IF NOT v_user_has_access AND NOT public.has_global_role('SUPER_ADMIN', auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: not a member of company';
  END IF;
  -- =========================================

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be > 0';
  END IF;
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'account_id is required';
  END IF;

  INSERT INTO public.expenses(
    company_id, user_id, account_id, amount, currency, expense_date,
    category, description, payment_method, reference, attachment_document_id
  )
  VALUES (
    p_company_id, auth.uid(), p_account_id, p_amount, p_currency,
    COALESCE(p_expense_date, current_date), p_category, p_description,
    COALESCE(p_payment_method, 'espèces'), p_reference, p_attachment_document_id
  )
  RETURNING id INTO v_expense_id;

  INSERT INTO public.journal_entries(
    user_id, company_id, entry_date, reference, description, created_by_user_id
  )
  VALUES (
    auth.uid(), p_company_id, COALESCE(p_expense_date, current_date),
    COALESCE(p_reference, 'Dépense'), COALESCE(p_description, 'Dépense'), auth.uid()
  )
  RETURNING id INTO v_entry_id;

  UPDATE public.expenses SET journal_entry_id = v_entry_id WHERE id = v_expense_id;

  v_expense_account_id := public.ensure_company_account(
    p_company_id, '600-expenses', 'Charges', 'charge'
  );

  INSERT INTO public.journal_lines(entry_id, account_id, debit, credit)
  VALUES (v_entry_id, v_expense_account_id, p_amount, 0);

  INSERT INTO public.journal_lines(entry_id, account_id, debit, credit)
  VALUES (v_entry_id, p_account_id, 0, p_amount);

  RETURN v_expense_id;
END;
$$;

-- 6. Fix create_account_load_operation - add authorization check
CREATE OR REPLACE FUNCTION public.create_account_load_operation(
  p_company_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_load_date date,
  p_origin text,
  p_notes text,
  p_currency text DEFAULT 'TND',
  p_attachment_document_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_load_id uuid;
  v_entry_id uuid;
  v_counterpart_id uuid;
  v_ref text;
  v_desc text;
  v_user_has_access boolean := false;
BEGIN
  -- =========================================
  -- SECURITY CHECK: Verify caller has access to the company
  -- =========================================
  SELECT EXISTS(
    SELECT 1 FROM public.company_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.company_id = p_company_id
      AND cu.role IN ('company_admin', 'comptable', 'gerant')
  ) INTO v_user_has_access;
  
  IF NOT v_user_has_access AND NOT public.has_global_role('SUPER_ADMIN', auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: not a member of company';
  END IF;
  -- =========================================

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be > 0';
  END IF;
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'account_id is required';
  END IF;

  v_ref := 'Charger compte';
  v_desc := COALESCE(NULLIF(p_origin, ''), 'Encaissement autonome');

  INSERT INTO public.account_loads(
    company_id, user_id, account_id, amount, currency, load_date,
    origin, notes, attachment_document_id
  )
  VALUES (
    p_company_id, auth.uid(), p_account_id, p_amount, COALESCE(p_currency, 'TND'),
    COALESCE(p_load_date, current_date), p_origin, p_notes, p_attachment_document_id
  )
  RETURNING id INTO v_load_id;

  INSERT INTO public.journal_entries(
    user_id, company_id, entry_date, reference, description, created_by_user_id
  )
  VALUES (
    auth.uid(), p_company_id, COALESCE(p_load_date, current_date),
    v_ref, v_desc, auth.uid()
  )
  RETURNING id INTO v_entry_id;

  UPDATE public.account_loads SET journal_entry_id = v_entry_id WHERE id = v_load_id;

  v_counterpart_id := public.ensure_company_account(
    p_company_id, '999-loads', 'Compte de contrepartie chargements', 'passif'
  );

  INSERT INTO public.journal_lines(entry_id, account_id, debit, credit)
  VALUES (v_entry_id, p_account_id, p_amount, 0);

  INSERT INTO public.journal_lines(entry_id, account_id, debit, credit)
  VALUES (v_entry_id, v_counterpart_id, 0, p_amount);

  RETURN v_load_id;
END;
$$;