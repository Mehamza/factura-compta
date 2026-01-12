-- Split invoice lifecycle status vs payment status, and fix DB totals to match UI (discount + FODEC + per-line VAT)

-- 1) Add payment_status to invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_payment_status_check'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_payment_status_check
      CHECK (payment_status IN ('unpaid','partial','paid','overdue'));
  END IF;
END $$;

-- 2) Recompute invoice totals to match frontend calculateTotals()
-- Rules:
-- - subtotal = SUM(invoice_items.total)
-- - totalFodec = SUM(invoice_items.fodec_amount)
-- - discount applies only to HT (subtotal) and proportionally reduces VAT base for HT
-- - VAT is computed per line using (adjustedHT + fodec) * vat_rate
-- - total = (subtotalAfterDiscount + totalFodec) + taxAmount + stamp
-- - credit notes never carry stamp
CREATE OR REPLACE FUNCTION public.recompute_invoice_totals(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal numeric := 0;
  v_total_fodec numeric := 0;
  v_discount_type text;
  v_discount_value numeric := 0;
  v_discount_amount numeric := 0;
  v_subtotal_after_discount numeric := 0;
  v_discount_ratio numeric := 1;
  v_tax_amount numeric := 0;
  v_stamp_included boolean := false;
  v_stamp_amount numeric := 0;
  v_kind text;
BEGIN
  SELECT
    COALESCE(SUM(total), 0),
    COALESCE(SUM(fodec_amount), 0)
  INTO v_subtotal, v_total_fodec
  FROM public.invoice_items
  WHERE invoice_id = p_invoice_id;

  SELECT
    discount_type,
    COALESCE(discount_value, 0),
    stamp_included,
    COALESCE(stamp_amount, 0),
    document_kind
  INTO v_discount_type, v_discount_value, v_stamp_included, v_stamp_amount, v_kind
  FROM public.invoices
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Credit notes never carry stamp
  IF v_kind IN ('facture_avoir', 'avoir_achat') THEN
    v_stamp_included := false;
    v_stamp_amount := 0;
  END IF;

  -- Compute discount amount
  v_discount_amount := 0;
  IF v_discount_value > 0 THEN
    IF v_discount_type = 'percent' THEN
      v_discount_amount := v_subtotal * (v_discount_value / 100.0);
    ELSIF v_discount_type = 'fixed' THEN
      v_discount_amount := v_discount_value;
    END IF;
  END IF;

  v_subtotal_after_discount := v_subtotal - v_discount_amount;

  -- Match frontend: only compute ratio when subtotal > 0
  v_discount_ratio := CASE WHEN v_subtotal > 0 THEN (v_subtotal_after_discount / v_subtotal) ELSE 1 END;

  -- Compute VAT using adjusted HT + full FODEC
  SELECT
    COALESCE(
      SUM(
        ((COALESCE(ii.total, 0) * v_discount_ratio) + COALESCE(ii.fodec_amount, 0))
        * (COALESCE(ii.vat_rate, 0) / 100.0)
      ),
      0
    )
  INTO v_tax_amount
  FROM public.invoice_items ii
  WHERE ii.invoice_id = p_invoice_id;

  UPDATE public.invoices
  SET
    subtotal = v_subtotal,
    fodec_amount = v_total_fodec,
    tax_amount = v_tax_amount,
    discount_amount = v_discount_amount,
    total = (v_subtotal_after_discount + v_total_fodec) + v_tax_amount + CASE WHEN v_stamp_included THEN v_stamp_amount ELSE 0 END
  WHERE id = p_invoice_id;
END;
$$;

-- 3) Ensure invoice recompute triggers include discount changes
CREATE OR REPLACE FUNCTION public.trg_invoices_recompute_on_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_invoice_totals(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_recompute_on_change ON public.invoices;
CREATE TRIGGER trg_invoices_recompute_on_change
AFTER UPDATE OF stamp_included, stamp_amount, discount_type, discount_value, document_kind ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.trg_invoices_recompute_on_change();

-- 4) Payment status recompute (derived from payments + due_date + (optionally) credit notes)
CREATE OR REPLACE FUNCTION public.recompute_invoice_payment_status(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
  v_status text;
  v_due_date date;
  v_total numeric := 0;
  v_credit_notes_total numeric := 0;
  v_effective_total numeric := 0;
  v_paid numeric := 0;
  v_payment_status text := 'unpaid';
BEGIN
  SELECT document_kind, status, due_date, total
  INTO v_kind, v_status, v_due_date, v_total
  FROM public.invoices
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Only invoices can have a payment_status
  IF v_kind NOT IN ('facture', 'facture_achat') THEN
    RETURN;
  END IF;

  -- Draft/cancelled never considered paid
  IF v_status IN ('draft', 'cancelled') THEN
    UPDATE public.invoices
    SET payment_status = 'unpaid'
    WHERE id = p_invoice_id;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(COALESCE(net_amount, amount)), 0)
  INTO v_paid
  FROM public.payments
  WHERE invoice_id = p_invoice_id;

  -- Credit notes linked to this invoice reduce the effective total (they should be negative)
  SELECT COALESCE(SUM(cn.total), 0)
  INTO v_credit_notes_total
  FROM public.invoices cn
  WHERE cn.source_invoice_id = p_invoice_id;

  v_effective_total := v_total + v_credit_notes_total;

  IF v_paid >= v_effective_total THEN
    v_payment_status := 'paid';
  ELSIF v_paid > 0 THEN
    v_payment_status := 'partial';
  ELSIF v_due_date < CURRENT_DATE THEN
    v_payment_status := 'overdue';
  ELSE
    v_payment_status := 'unpaid';
  END IF;

  UPDATE public.invoices
  SET payment_status = v_payment_status
  WHERE id = p_invoice_id;
END;
$$;

-- 5) Payment trigger updates payment_status (not invoices.status)
CREATE OR REPLACE FUNCTION public.trg_payment_update_invoice_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.invoice_id IS NOT NULL THEN
    PERFORM public.recompute_invoice_payment_status(OLD.invoice_id);
  ELSIF NEW.invoice_id IS NOT NULL THEN
    PERFORM public.recompute_invoice_payment_status(NEW.invoice_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Remove legacy trigger that wrote payment states into invoices.status
DROP TRIGGER IF EXISTS trg_invoice_status_after_payment ON public.payments;
DROP FUNCTION IF EXISTS public.refresh_invoice_status();

DROP TRIGGER IF EXISTS trg_payments_update_invoice_status ON public.payments;
CREATE TRIGGER trg_payments_update_invoice_status
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.trg_payment_update_invoice_status();

-- 6) Also recompute payment_status when invoice lifecycle/due date/total changes
CREATE OR REPLACE FUNCTION public.trg_invoices_recompute_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_invoice_payment_status(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_recompute_payment_status ON public.invoices;
CREATE TRIGGER trg_invoices_recompute_payment_status
AFTER UPDATE OF due_date, status, total, document_kind ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.trg_invoices_recompute_payment_status();

-- 7) Backfill / normalize existing data
-- Move any legacy payment-like statuses back to a lifecycle status, and set payment_status accordingly
UPDATE public.invoices
SET status = 'validated'
WHERE document_kind IN ('facture', 'facture_achat')
  AND status IN ('paid', 'partial', 'overdue');

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.invoices WHERE document_kind IN ('facture', 'facture_achat')
  LOOP
    PERFORM public.recompute_invoice_totals(r.id);
    PERFORM public.recompute_invoice_payment_status(r.id);
  END LOOP;
END $$;
