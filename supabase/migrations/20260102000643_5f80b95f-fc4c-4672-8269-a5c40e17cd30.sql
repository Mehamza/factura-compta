-- Fix the audit_invoices trigger to use lowercase action values matching the check constraint
CREATE OR REPLACE FUNCTION public.audit_invoices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs(user_id, action, table_name, record_id, changes)
  VALUES (
    auth.uid(), 
    CASE 
      WHEN tg_op = 'INSERT' THEN 'create'
      WHEN tg_op = 'UPDATE' THEN 'update'
      WHEN tg_op = 'DELETE' THEN 'delete'
    END,
    'invoices', 
    COALESCE(NEW.id, OLD.id),
    CASE WHEN tg_op = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END
  );
  RETURN NULL;
END;
$$;