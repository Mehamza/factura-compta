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
  const value = feature.value as { enabled?: boolean; value?: number | null };
  const enabled = value?.enabled;
  const numeric = value?.value;

  switch (feature.key) {
    case 'billing.invoices_unlimited':
      return enabled ? 'Factures illimitées' : 'Nombre de factures limité';
    case 'billing.max_invoices_per_day':
      return numeric == null ? 'Limite de factures non définie' : `Maximum ${numeric} factures par jour`;
    case 'billing.invoice_edit':
      return enabled ? 'Modification des factures' : 'Modification des factures non incluse';
    case 'billing.pdf_watermark':
      return enabled ? 'Filigrane sur les PDF' : 'PDF sans filigrane';
    case 'users.max_users':
      return numeric == null ? 'Utilisateurs non limités' : `Jusqu’à ${numeric} utilisateurs`;
    case 'stock.readonly':
      return enabled ? 'Consultation du stock' : 'Consultation du stock non incluse';
    case 'stock.manage_products':
      return enabled ? 'Gestion des produits' : 'Gestion des produits non incluse';
    case 'stock.stock_alerts':
      return enabled ? 'Alertes de stock' : 'Alertes de stock non incluses';
    case 'export.csv':
      return enabled ? 'Export CSV' : 'Export CSV non inclus';
    case 'reports.access':
      return enabled ? 'Accès aux rapports' : 'Rapports non inclus';
    case 'accounting.access':
      return enabled ? 'Module comptable' : 'Module comptable non inclus';
    default:
      return feature.key;
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
        setPlans(planRows);
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
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan, index) => {
          const requestPath = `/subscription?plan=${encodeURIComponent(plan.id)}`;
          const href = user
            ? requestPath
            : `/auth?redirectTo=${encodeURIComponent(requestPath)}`;
          const planFeatures = features[plan.id] || [];

          return (
            <Card
              key={plan.id}
              className={`relative ${index === 1 ? 'border-primary shadow-lg' : ''}`}
            >
              {index === 1 && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Recommandé</Badge>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description || plan.duration}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    {Number(plan.price_year).toLocaleString('fr-FR')}
                  </span>
                  <span className="text-muted-foreground"> TND / {plan.duration}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {planFeatures.length > 0 && (
                  <ul className="space-y-3">
                    {planFeatures.map((feature) => (
                      <li key={`${feature.plan_id}-${feature.key}`} className="flex gap-2 text-sm">
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                        <span>{getFeatureLabel(feature)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Button className="w-full" variant={index === 1 ? 'default' : 'outline'} asChild>
                  <Link to={href}>{user ? 'Demander ce plan' : 'Se connecter pour demander'}</Link>
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Activation après vérification du paiement par l’administration.
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
