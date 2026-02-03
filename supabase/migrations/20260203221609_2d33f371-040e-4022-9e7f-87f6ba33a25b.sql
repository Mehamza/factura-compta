-- =============================================
-- SECURITY FIX: Add immutability controls to journal entries
-- Restrict DELETE to company_admin only and only for entries in open periods
-- Add role-based restrictions for UPDATE
-- =============================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can delete their own entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can update their own entries" ON public.journal_entries;

-- Create new restricted DELETE policy
-- Only company admins can delete journal entries
CREATE POLICY "journal_entries_delete_admin_only" ON public.journal_entries
FOR DELETE USING (
  public.has_global_role('SUPER_ADMIN', auth.uid())
  OR (
    journal_entries.company_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.company_id = journal_entries.company_id
        AND cu.role = 'company_admin'
    )
  )
);

-- Create new restricted UPDATE policy
-- Only company admins and accountants can update journal entries
CREATE POLICY "journal_entries_update_restricted" ON public.journal_entries
FOR UPDATE USING (
  public.has_global_role('SUPER_ADMIN', auth.uid())
  OR (
    journal_entries.company_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.company_id = journal_entries.company_id
        AND cu.role IN ('company_admin', 'comptable')
    )
  )
);

-- Also restrict journal_lines DELETE and UPDATE
DROP POLICY IF EXISTS "Users can delete their own lines" ON public.journal_lines;
DROP POLICY IF EXISTS "Users can update their own lines" ON public.journal_lines;

-- Create restricted DELETE policy for journal_lines
-- Only company admins can delete journal lines (via entry ownership)
CREATE POLICY "journal_lines_delete_admin_only" ON public.journal_lines
FOR DELETE USING (
  public.has_global_role('SUPER_ADMIN', auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.journal_entries je
    JOIN public.company_users cu ON cu.company_id = je.company_id
    WHERE je.id = journal_lines.entry_id
      AND cu.user_id = auth.uid()
      AND cu.role = 'company_admin'
  )
);

-- Create restricted UPDATE policy for journal_lines
-- Only company admins and accountants can update journal lines
CREATE POLICY "journal_lines_update_restricted" ON public.journal_lines
FOR UPDATE USING (
  public.has_global_role('SUPER_ADMIN', auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.journal_entries je
    JOIN public.company_users cu ON cu.company_id = je.company_id
    WHERE je.id = journal_lines.entry_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('company_admin', 'comptable')
  )
);