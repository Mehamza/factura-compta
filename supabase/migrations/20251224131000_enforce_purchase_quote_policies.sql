-- Enforce rules around 'purchase_quote' documents
-- 1) Restrict updates on invoices in purchase_quote state to admin/accountant only
-- 2) Prevent creating payments referencing purchase_quote invoices
-- 3) Prevent creating journal_lines that reference purchase_quote invoices

-- 1) invoices update policy
DROP POLICY IF EXISTS "Users can update their own invoices" ON public.invoices;
CREATE POLICY "Users can update their own invoices" ON public.invoices
  FOR UPDATE
  USING (
    -- owners can update non-purchase-quote invoices
    (status <> 'purchase_quote' AND user_id = auth.uid())
    -- admins and accountants can update anything
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  );

-- 2) payments insert policy: disallow payment insertion for invoices that are purchase quotes
DROP POLICY IF EXISTS pay_insert ON public.payments;
CREATE POLICY pay_insert ON public.payments
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      invoice_id IS NULL
      OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.status <> 'purchase_quote')
    )
  );

-- 3) journal_lines insert policy: disallow lines referencing purchase_quote invoices
DROP POLICY IF EXISTS "Users can create journal lines" ON public.journal_lines;
CREATE POLICY "Users can create journal lines" ON public.journal_lines
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_lines.entry_id AND je.user_id = auth.uid())
    AND (
      invoice_id IS NULL
      OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.status <> 'purchase_quote')
    )
  );

-- Note: stock_movements table currently does not reference invoices; blocking stock movements
-- for purchase quotes should be handled at application level (UI) or by adding invoice_id to stock_movements schema.
