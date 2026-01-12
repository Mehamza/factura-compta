-- ============================================
-- REFACTORING: Modèle de facturation conforme Tunisie
-- Fusion facture_credit + facture_payee → facture unique
-- Ajout retenue à la source sur paiements
-- Création table warehouses
-- ============================================

-- 1. Créer la table warehouses si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  address text,
  city text,
  country text DEFAULT 'Tunisie',
  manager_name text,
  manager_phone text,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_warehouses_company_id ON public.warehouses(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_is_default ON public.warehouses(company_id, is_default) WHERE is_default = true;

-- RLS
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- Policies pour warehouses
DROP POLICY IF EXISTS "Users can view warehouses in their companies" ON public.warehouses;
CREATE POLICY "Users can view warehouses in their companies"
ON public.warehouses FOR SELECT
USING (
  company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admins can manage warehouses" ON public.warehouses;
CREATE POLICY "Admins can manage warehouses"
ON public.warehouses FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE user_id = auth.uid() 
      AND company_id = warehouses.company_id 
      AND role IN ('company_admin', 'gerant')
  )
);

-- 2. Créer la table warehouse_products si elle n'existe pas (stock par entrepôt)
CREATE TABLE IF NOT EXISTS public.warehouse_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity numeric DEFAULT 0,
  min_stock numeric DEFAULT 0,
  max_stock numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(warehouse_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_products_warehouse ON public.warehouse_products(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_products_product ON public.warehouse_products(product_id);

ALTER TABLE public.warehouse_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view warehouse_products" ON public.warehouse_products;
CREATE POLICY "Users can view warehouse_products"
ON public.warehouse_products FOR SELECT
USING (
  warehouse_id IN (
    SELECT w.id FROM public.warehouses w
    JOIN public.company_users cu ON cu.company_id = w.company_id
    WHERE cu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can manage warehouse_products" ON public.warehouse_products;
CREATE POLICY "Admins can manage warehouse_products"
ON public.warehouse_products FOR ALL
USING (
  warehouse_id IN (
    SELECT w.id FROM public.warehouses w
    JOIN public.company_users cu ON cu.company_id = w.company_id
    WHERE cu.user_id = auth.uid() AND cu.role IN ('company_admin', 'gerant', 'comptable')
  )
);

-- 3. Ajouter les champs de retenue à la source sur la table payments
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS withholding_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS withholding_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS gross_amount numeric,
ADD COLUMN IF NOT EXISTS net_amount numeric;

-- Migrer les données existantes
UPDATE public.payments
SET 
  gross_amount = amount,
  net_amount = amount
WHERE gross_amount IS NULL;

-- 4. Fonction pour garantir un seul entrepôt par défaut par société
CREATE OR REPLACE FUNCTION public.enforce_single_default_warehouse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.warehouses 
    SET is_default = false 
    WHERE company_id = NEW.company_id 
      AND id != NEW.id 
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_default_warehouse ON public.warehouses;
CREATE TRIGGER trg_enforce_single_default_warehouse
BEFORE INSERT OR UPDATE ON public.warehouses
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_default_warehouse();

-- 5. Fonction pour mettre à jour le statut de facture basé sur les paiements
CREATE OR REPLACE FUNCTION public.update_invoice_payment_status(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
  v_paid numeric;
  v_current_status text;
BEGIN
  SELECT total, status INTO v_total, v_current_status
  FROM public.invoices 
  WHERE id = p_invoice_id;
  
  IF NOT FOUND THEN RETURN; END IF;
  IF v_current_status IN ('cancelled', 'draft') THEN RETURN; END IF;
  
  SELECT COALESCE(SUM(COALESCE(net_amount, amount)), 0) INTO v_paid
  FROM public.payments 
  WHERE invoice_id = p_invoice_id;
  
  UPDATE public.invoices
  SET status = CASE
    WHEN v_paid >= v_total THEN 'paid'
    WHEN v_paid > 0 THEN 'partial'
    WHEN due_date < CURRENT_DATE THEN 'overdue'
    ELSE 'validated'
  END
  WHERE id = p_invoice_id;
END;
$$;

-- 6. Trigger pour mettre à jour le statut après paiement
CREATE OR REPLACE FUNCTION public.trg_payment_update_invoice_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.invoice_id IS NOT NULL THEN
    PERFORM public.update_invoice_payment_status(OLD.invoice_id);
  ELSIF NEW.invoice_id IS NOT NULL THEN
    PERFORM public.update_invoice_payment_status(NEW.invoice_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_update_invoice_status ON public.payments;
CREATE TRIGGER trg_payments_update_invoice_status
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.trg_payment_update_invoice_status();

-- 7. Migrer les factures vers le nouveau modèle unifié
-- facture_payee → facture avec status = 'paid'
UPDATE public.invoices
SET document_kind = 'facture', status = 'paid'
WHERE document_kind = 'facture_payee';

-- facture_credit → facture (garde le statut existant)
UPDATE public.invoices
SET document_kind = 'facture'
WHERE document_kind = 'facture_credit';

-- facture_credit_achat → facture_achat
UPDATE public.invoices
SET document_kind = 'facture_achat'
WHERE document_kind = 'facture_credit_achat';

-- 8. Trigger updated_at pour warehouses
DROP TRIGGER IF EXISTS update_warehouses_updated_at ON public.warehouses;
CREATE TRIGGER update_warehouses_updated_at
BEFORE UPDATE ON public.warehouses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();