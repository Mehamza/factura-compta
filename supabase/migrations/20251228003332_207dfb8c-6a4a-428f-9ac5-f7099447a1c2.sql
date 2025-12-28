-- Phase 2: Add company_id to business tables and update RLS policies

-- 1. Add company_id to all business tables

-- Invoices
ALTER TABLE public.invoices 
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Payments
ALTER TABLE public.payments 
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Products
ALTER TABLE public.products 
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Stock Movements
ALTER TABLE public.stock_movements 
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Clients
ALTER TABLE public.clients 
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Suppliers
ALTER TABLE public.suppliers 
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Journal Entries
ALTER TABLE public.journal_entries 
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Accounts
ALTER TABLE public.accounts 
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Documents
ALTER TABLE public.documents 
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 2. Create indexes for performance
CREATE INDEX idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX idx_payments_company_id ON public.payments(company_id);
CREATE INDEX idx_products_company_id ON public.products(company_id);
CREATE INDEX idx_stock_movements_company_id ON public.stock_movements(company_id);
CREATE INDEX idx_clients_company_id ON public.clients(company_id);
CREATE INDEX idx_suppliers_company_id ON public.suppliers(company_id);
CREATE INDEX idx_journal_entries_company_id ON public.journal_entries(company_id);
CREATE INDEX idx_accounts_company_id ON public.accounts(company_id);
CREATE INDEX idx_documents_company_id ON public.documents(company_id);

-- 3. Update RLS policies for invoices
DROP POLICY IF EXISTS "Users can view their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can create their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete their own invoices" ON public.invoices;

CREATE POLICY "Users can view company invoices" ON public.invoices
FOR SELECT USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid()) -- Legacy fallback
);

CREATE POLICY "Users can create company invoices" ON public.invoices
FOR INSERT WITH CHECK (
  public.user_in_company(auth.uid(), company_id)
  OR (company_id IS NULL AND user_id = auth.uid()) -- Legacy fallback
);

CREATE POLICY "Users can update company invoices" ON public.invoices
FOR UPDATE USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid()) -- Legacy fallback
);

CREATE POLICY "Users can delete company invoices" ON public.invoices
FOR DELETE USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid()) -- Legacy fallback
);

-- 4. Update RLS policies for payments
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can create their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can update their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can delete their own payments" ON public.payments;

CREATE POLICY "Users can view company payments" ON public.payments
FOR SELECT USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can create company payments" ON public.payments
FOR INSERT WITH CHECK (
  public.user_in_company(auth.uid(), company_id)
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can update company payments" ON public.payments
FOR UPDATE USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can delete company payments" ON public.payments
FOR DELETE USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

-- 5. Update RLS policies for products
DROP POLICY IF EXISTS "Users can view their own products" ON public.products;
DROP POLICY IF EXISTS "Users can create their own products" ON public.products;
DROP POLICY IF EXISTS "Users can update their own products" ON public.products;
DROP POLICY IF EXISTS "Users can delete their own products" ON public.products;

CREATE POLICY "Users can view company products" ON public.products
FOR SELECT USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can create company products" ON public.products
FOR INSERT WITH CHECK (
  public.user_in_company(auth.uid(), company_id)
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can update company products" ON public.products
FOR UPDATE USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can delete company products" ON public.products
FOR DELETE USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

-- 6. Update RLS policies for stock_movements
DROP POLICY IF EXISTS "Users can view their own movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Users can create their own movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Users can update their own movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Users can delete their own movements" ON public.stock_movements;

CREATE POLICY "Users can view company movements" ON public.stock_movements
FOR SELECT USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can create company movements" ON public.stock_movements
FOR INSERT WITH CHECK (
  public.user_in_company(auth.uid(), company_id)
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can update company movements" ON public.stock_movements
FOR UPDATE USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can delete company movements" ON public.stock_movements
FOR DELETE USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

-- 7. Update RLS policies for clients
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can create their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;

CREATE POLICY "Users can view company clients" ON public.clients
FOR SELECT USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can create company clients" ON public.clients
FOR INSERT WITH CHECK (
  public.user_in_company(auth.uid(), company_id)
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can update company clients" ON public.clients
FOR UPDATE USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can delete company clients" ON public.clients
FOR DELETE USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

-- 8. Update RLS policies for suppliers
DROP POLICY IF EXISTS "Users can view their own suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can create their own suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can update their own suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can delete their own suppliers" ON public.suppliers;

CREATE POLICY "Users can view company suppliers" ON public.suppliers
FOR SELECT USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can create company suppliers" ON public.suppliers
FOR INSERT WITH CHECK (
  public.user_in_company(auth.uid(), company_id)
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can update company suppliers" ON public.suppliers
FOR UPDATE USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can delete company suppliers" ON public.suppliers
FOR DELETE USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

-- 9. Update RLS policies for journal_entries
DROP POLICY IF EXISTS "Users can view their own entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can create their own entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can update their own entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can delete their own entries" ON public.journal_entries;

CREATE POLICY "Users can view company entries" ON public.journal_entries
FOR SELECT USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can create company entries" ON public.journal_entries
FOR INSERT WITH CHECK (
  public.user_in_company(auth.uid(), company_id)
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can update company entries" ON public.journal_entries
FOR UPDATE USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can delete company entries" ON public.journal_entries
FOR DELETE USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

-- 10. Update RLS policies for accounts
DROP POLICY IF EXISTS "Users can view their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can create their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete their own accounts" ON public.accounts;

CREATE POLICY "Users can view company accounts" ON public.accounts
FOR SELECT USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can create company accounts" ON public.accounts
FOR INSERT WITH CHECK (
  public.user_in_company(auth.uid(), company_id)
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can update company accounts" ON public.accounts
FOR UPDATE USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can delete company accounts" ON public.accounts
FOR DELETE USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

-- 11. Update RLS policies for documents
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can create their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;

CREATE POLICY "Users can view company documents" ON public.documents
FOR SELECT USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can create company documents" ON public.documents
FOR INSERT WITH CHECK (
  public.user_in_company(auth.uid(), company_id)
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can update company documents" ON public.documents
FOR UPDATE USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can delete company documents" ON public.documents
FOR DELETE USING (
  public.user_in_company(auth.uid(), company_id)
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NULL AND user_id = auth.uid())
);