-- MIGRATION: Renforcement sécurité multi-tenant pour stock_movements
-- Les policies actuelles ne filtrent que par user_id, pas company_id

-- Supprimer les anciennes policies insuffisantes
DROP POLICY IF EXISTS "Users can create their own movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Users can delete their own movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Users can update their own movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Users can view their own movements" ON public.stock_movements;

-- Nouvelles policies avec isolation par company_id via user_company_roles
CREATE POLICY "stock_movements_company_members_select"
ON public.stock_movements
FOR SELECT
USING (
  has_global_role('SUPER_ADMIN', auth.uid())
  OR (
    company_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM user_company_roles ucr
      WHERE ucr.user_id = auth.uid() AND ucr.company_id = stock_movements.company_id
    )
  )
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "stock_movements_company_members_insert"
ON public.stock_movements
FOR INSERT
WITH CHECK (
  has_global_role('SUPER_ADMIN', auth.uid())
  OR (
    user_id = auth.uid()
    AND (
      company_id IS NULL
      OR EXISTS (
        SELECT 1 FROM user_company_roles ucr
        WHERE ucr.user_id = auth.uid() AND ucr.company_id = stock_movements.company_id
      )
    )
  )
);

CREATE POLICY "stock_movements_company_members_update"
ON public.stock_movements
FOR UPDATE
USING (
  has_global_role('SUPER_ADMIN', auth.uid())
  OR (
    user_id = auth.uid()
    AND (
      company_id IS NULL
      OR EXISTS (
        SELECT 1 FROM user_company_roles ucr
        WHERE ucr.user_id = auth.uid() AND ucr.company_id = stock_movements.company_id
      )
    )
  )
);

CREATE POLICY "stock_movements_company_members_delete"
ON public.stock_movements
FOR DELETE
USING (
  has_global_role('SUPER_ADMIN', auth.uid())
  OR (
    user_id = auth.uid()
    AND (
      company_id IS NULL
      OR EXISTS (
        SELECT 1 FROM user_company_roles ucr
        WHERE ucr.user_id = auth.uid() AND ucr.company_id = stock_movements.company_id
      )
    )
  )
);