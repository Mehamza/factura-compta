-- 1. Supprimer les overloads incorrects de has_role s'ils existent
DROP FUNCTION IF EXISTS public.has_role(text, uuid);

-- 2. Créer les tables de plans
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_year numeric NOT NULL DEFAULT 0,
  duration text NOT NULL DEFAULT 'annuel',
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{"enabled": true}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, feature_key)
);

CREATE TABLE IF NOT EXISTS public.company_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Activer RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_plans ENABLE ROW LEVEL SECURITY;

-- 4. Politiques RLS
CREATE POLICY "Plans viewable by everyone" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Admins manage plans" ON public.plans FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Features viewable by everyone" ON public.plan_features FOR SELECT USING (true);
CREATE POLICY "Admins manage features" ON public.plan_features FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own company plans" ON public.company_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage company plans" ON public.company_plans FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 5. Fonction get_effective_permissions
CREATE OR REPLACE FUNCTION public.get_effective_permissions(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- 6. Triggers updated_at
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_plan_features_updated_at BEFORE UPDATE ON public.plan_features FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_company_plans_updated_at BEFORE UPDATE ON public.company_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Plan gratuit par défaut
INSERT INTO public.plans (name, description, price_year, duration, active, display_order)
VALUES ('Gratuit', 'Plan gratuit avec fonctionnalités de base', 0, 'unlimited', true, 0)
ON CONFLICT DO NOTHING;