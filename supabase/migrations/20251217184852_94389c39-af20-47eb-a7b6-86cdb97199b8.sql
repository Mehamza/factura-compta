-- Fix get_effective_permissions function to use correct column names
DROP FUNCTION IF EXISTS public.get_effective_permissions(uuid);

CREATE OR REPLACE FUNCTION public.get_effective_permissions(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_features jsonb := '{}'::jsonb;
BEGIN
  SELECT COALESCE(jsonb_object_agg(pf.feature_key, pf.value), '{}'::jsonb)
  INTO v_features
  FROM public.company_plans cp
  JOIN public.plan_features pf ON pf.plan_id = cp.plan_id
  WHERE cp.user_id = p_user_id
    AND cp.active = true
    AND (cp.ends_at IS NULL OR cp.ends_at > now());
  RETURN v_features;
END;
$function$;