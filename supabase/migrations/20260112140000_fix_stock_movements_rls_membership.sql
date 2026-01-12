-- Fix: stock_movements visibility for company members
-- Some environments use company_users for membership (current app), while older policies rely on user_company_roles.
-- Make policies accept either, so existing movements are visible.

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Drop prior policies if present
DROP POLICY IF EXISTS stock_movements_company_members_select ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_company_members_insert ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_company_members_update ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_company_members_delete ON public.stock_movements;

CREATE POLICY stock_movements_company_members_select
ON public.stock_movements
FOR SELECT
USING (
  public.has_global_role('SUPER_ADMIN', auth.uid())
  OR (
    company_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.company_users cu
        WHERE cu.user_id = auth.uid()
          AND cu.company_id = stock_movements.company_id
      )
      OR EXISTS (
        SELECT 1 FROM public.user_company_roles ucr
        WHERE ucr.user_id = auth.uid()
          AND ucr.company_id = stock_movements.company_id
      )
    )
  )
  OR (company_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY stock_movements_company_members_insert
ON public.stock_movements
FOR INSERT
WITH CHECK (
  public.has_global_role('SUPER_ADMIN', auth.uid())
  OR (
    user_id = auth.uid()
    AND (
      company_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.company_users cu
        WHERE cu.user_id = auth.uid()
          AND cu.company_id = stock_movements.company_id
      )
      OR EXISTS (
        SELECT 1 FROM public.user_company_roles ucr
        WHERE ucr.user_id = auth.uid()
          AND ucr.company_id = stock_movements.company_id
      )
    )
  )
);

CREATE POLICY stock_movements_company_members_update
ON public.stock_movements
FOR UPDATE
USING (
  public.has_global_role('SUPER_ADMIN', auth.uid())
  OR (
    user_id = auth.uid()
    AND (
      company_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.company_users cu
        WHERE cu.user_id = auth.uid()
          AND cu.company_id = stock_movements.company_id
      )
      OR EXISTS (
        SELECT 1 FROM public.user_company_roles ucr
        WHERE ucr.user_id = auth.uid()
          AND ucr.company_id = stock_movements.company_id
      )
    )
  )
);

CREATE POLICY stock_movements_company_members_delete
ON public.stock_movements
FOR DELETE
USING (
  public.has_global_role('SUPER_ADMIN', auth.uid())
  OR (
    user_id = auth.uid()
    AND (
      company_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.company_users cu
        WHERE cu.user_id = auth.uid()
          AND cu.company_id = stock_movements.company_id
      )
      OR EXISTS (
        SELECT 1 FROM public.user_company_roles ucr
        WHERE ucr.user_id = auth.uid()
          AND ucr.company_id = stock_movements.company_id
      )
    )
  )
);
