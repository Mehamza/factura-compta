-- Fix recompute_invoice_totals to sum item-level VAT amounts instead of using invoice-level tax_rate
CREATE OR REPLACE FUNCTION public.recompute_invoice_totals(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal numeric := 0;
  v_tax_amount numeric := 0;
  v_fodec_amount numeric := 0;
  v_stamp_included boolean := false;
  v_stamp_amount numeric := 0;
BEGIN
  -- Sum HT totals from items
  SELECT COALESCE(SUM(total), 0) INTO v_subtotal 
  FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  
  -- Sum VAT amounts from items (per-item VAT)
  SELECT COALESCE(SUM(vat_amount), 0) INTO v_tax_amount 
  FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  
  -- Sum FODEC amounts from items
  SELECT COALESCE(SUM(fodec_amount), 0) INTO v_fodec_amount 
  FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  
  -- Get stamp info
  SELECT stamp_included, stamp_amount INTO v_stamp_included, v_stamp_amount 
  FROM public.invoices WHERE id = p_invoice_id;
  
  -- Update invoice with calculated totals
  UPDATE public.invoices
  SET subtotal = v_subtotal,
      tax_amount = v_tax_amount,
      fodec_amount = v_fodec_amount,
      total = v_subtotal + v_fodec_amount + v_tax_amount + CASE WHEN v_stamp_included THEN COALESCE(v_stamp_amount, 0) ELSE 0 END
  WHERE id = p_invoice_id;
END;
$$;