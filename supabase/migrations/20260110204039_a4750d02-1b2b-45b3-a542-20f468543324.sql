-- =====================================================
-- MIGRATION: Correction structure documents et stock
-- =====================================================

-- 1) Ajouter source_invoice_id pour les avoirs (lien facture source)
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS source_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

-- 2) Ajouter colonnes discount pour persister les remises
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed'));

ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0;

ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;

-- 3) Ajouter product_id dans invoice_items pour traçabilité stock
ALTER TABLE public.invoice_items 
ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

-- 4) Ajouter colonnes traçabilité dans stock_movements (sans FK vers warehouses)
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS reference_type text;

ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS reference_id uuid;

-- 5) Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_invoices_source_invoice ON public.invoices(source_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_document_kind ON public.invoices(document_kind);
CREATE INDEX IF NOT EXISTS idx_invoices_company_kind ON public.invoices(company_id, document_kind);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON public.invoice_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON public.stock_movements(reference_type, reference_id);