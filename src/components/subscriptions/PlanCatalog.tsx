import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type Plan = {
  id: string;
  name: string;
  description: string | null;
  price_year: number;
  duration: string;
  display_order: number;
};

type PlanFeature = {
  plan_id: string;
  key: string;
  value: unknown;
};

function getFeatureLabel(feature: PlanFeature): string {
  const value = typeof feature.value === 'number'
    ? { value: feature.value }
    : feature.value as { enabled?: boolean; value?: number | null } | null;
  const enabled = value?.enabled;
  const numeric = value?.value;

  switch (feature.key) {
    case 'billing.invoices_unlimited':
      return enabled ? 'Factures illimitées' : null;
    case 'billing.max_invoices_per_month':
      return numeric == null ? '15 factures par mois' : `${numeric} factures par mois`;
    case 'billing.max_invoices_per_day':
      return numeric == null ? null : `Jusqu’à ${numeric} factures par jour`;
    case 'billing.invoice_edit':
      return enabled ? 'Modification des factures' : null;
    case 'billing.pdf_watermark':
      return enabled === false ? 'Export PDF sans filigrane' : null;
    case 'users.max_users':
      return numeric == null || numeric <= 0
        ? 'Utilisateurs illimités'
        : numeric === 1
          ? '1 utilisateur'
          : `${numeric} utilisateurs`;
    case 'stock.readonly':
      return enabled ? 'Consultation du stock' : null;
    case 'stock.manage_products':
      return enabled ? 'Gestion complète du stock et des produits' : null;
    case 'stock.stock_alerts':
      return enabled ? 'Alertes de stock' : null;
    case 'export.csv':
      return enabled ? 'Export CSV' : null;
    case 'reports.access':
      return enabled ? 'Accès aux rapports' : null;
    case 'accounting.access':
      return enabled ? 'Module comptable' : null;
    default:
      return null;
  }
}

export function PlanCatalog() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Record<string, PlanFeature[]>>({});
  const [loading, setLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);
  const [featureError, setFeatureError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadPlans = async () => {
      setLoading(true);
      setPlanError(null);
      setFeatureError(null);
      const { data: planData, error: planError } = await supabase
        .from('plans')
        .select('id,name,description,price_year,duration,display_order')
        .eq('active', true)
        .order('display_order');

      if (planError) {
        if (!cancelled) setPlanError(planError.message);
        if (!cancelled) setLoading(false);
        return;
      }

      const planRows = (planData || []) as Plan[];
      if (!cancelled) setPlans(planRows);
      const planIds = planRows.map((plan) => plan.id);
      if (planIds.length === 0) {
        if (!cancelled) {
          setFeatures({});
          setLoading(false);
        }
        return;
      }

      const { data: featureData, error: featureError } = await supabase
        .from('plan_features')
        .select('plan_id,key,value')
        .in('plan_id', planIds);

      if (featureError) {
        if (!cancelled) {
          setFeatureError(featureError.message);
          setFeatures({});
        }
        if (!cancelled) setLoading(false);
        return;
      }

      const grouped: Record<string, PlanFeature[]> = {};
      (featureData || []).forEach((feature) => {
        grouped[feature.plan_id] ||= [];
        grouped[feature.plan_id].push(feature as PlanFeature);
      });

      if (!cancelled) {
        setFeatures(grouped);
        setLoading(false);
      }
    };

    void loadPlans();
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" role="status">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Chargement des tarifs…</span>
      </div>
    );
  }

  if (planError) {
    return (
      <div className="py-10 text-center text-destructive" role="alert">
        <p>Impossible de charger les tarifs : {planError}</p>
        <Button className="mt-4" variant="outline" onClick={() => setRetryCount((count) => count + 1)}>
          Réessayer
        </Button>
      </div>
    );
  }

  if (plans.length === 0) {
    return <p className="py-10 text-center text-muted-foreground">Aucun plan actif pour le moment.</p>;
  }

  return (
    <div className="space-y-6">
      {featureError && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-muted-foreground" role="status">
          Les tarifs sont affichés, mais certaines fonctionnalités ne peuvent pas être chargées : {featureError}
        </p>
      )}
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
        {plans.map((plan) => {
          const isFree = Number(plan.price_year) === 0;
          const requestPath = `/subscription?plan=${encodeURIComponent(plan.id)}`;
          const href = user
            ? requestPath
            : `/auth?redirectTo=${encodeURIComponent(requestPath)}`;
          const planFeatures = (features[plan.id] || [])
            .map((feature) => ({ feature, label: getFeatureLabel(feature) }))
            .filter((entry): entry is { feature: PlanFeature; label: string } => Boolean(entry.label));

          return (
            <Card
              key={plan.id}
              className={`relative ${!isFree ? 'border-primary shadow-lg' : ''}`}
            >
              {!isFree && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Recommandé</Badge>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description || plan.duration}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    {Number(plan.price_year).toLocaleString('fr-FR')}
                  </span>
                  <span className="text-muted-foreground">
                    {isFree ? ' TND' : ` TND / ${plan.duration}`}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <ul className="min-h-24 space-y-3">
                  {planFeatures.map(({ feature, label }) => (
                    <li key={`${feature.plan_id}-${feature.key}`} className="flex gap-2 text-sm">
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant={!isFree ? 'default' : 'outline'} asChild>
                  <Link to={href}>
                    {user
                      ? isFree ? 'Activer gratuitement' : 'Choisir Pro'
                      : isFree ? 'Commencer gratuitement' : 'Choisir Pro'}
                  </Link>
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {isFree
                    ? 'Activation immédiate après connexion.'
                    : 'Activation après vérification du paiement par l’administration.'}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
