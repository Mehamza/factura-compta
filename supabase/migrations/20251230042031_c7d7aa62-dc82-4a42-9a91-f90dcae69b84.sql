-- Update invoice_items RLS policies to allow company members to access items
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can create invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can update invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can delete invoice items" ON public.invoice_items;

-- Create new policies that check company membership through invoices
CREATE POLICY "Users can view invoice items" 
ON public.invoice_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND (
      invoices.user_id = auth.uid() 
      OR user_in_company(auth.uid(), invoices.company_id)
      OR is_super_admin(auth.uid())
    )
  )
);

CREATE POLICY "Users can create invoice items" 
ON public.invoice_items 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND (
      invoices.user_id = auth.uid() 
      OR user_in_company(auth.uid(), invoices.company_id)
    )
  )
);

CREATE POLICY "Users can update invoice items" 
ON public.invoice_items 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND (
      invoices.user_id = auth.uid() 
      OR user_in_company(auth.uid(), invoices.company_id)
      OR is_super_admin(auth.uid())
    )
  )
);

CREATE POLICY "Users can delete invoice items" 
ON public.invoice_items 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND (
      invoices.user_id = auth.uid() 
      OR user_in_company(auth.uid(), invoices.company_id)
      OR is_super_admin(auth.uid())
    )
  )
);