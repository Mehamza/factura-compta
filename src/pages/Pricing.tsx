import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Plan = { id: string; name: string; description: string | null; price_year: number; active: boolean; display_order: number };
type Feature = { plan_id: string; key: string; value: any };

export default function Pricing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Record<string, Feature[]>>({});

  useEffect(() => { load(); }, []);
  const load = async () => {
    const { data: plansData } = await (supabase.from('plans' as any).select('*').eq('active', true).order('display_order') as any);
    setPlans((plansData as Plan[]) || []);
    const { data: feats } = await (supabase.from('plan_features' as any).select('*') as any);
    const byPlan: Record<string, Feature[]> = {};
    ((feats as any[]) || []).forEach((f: any) => {
      if (!byPlan[f.plan_id]) byPlan[f.plan_id] = [];
      const key = (f.key ?? f.feature_key) as string | undefined;
      if (!key) return;
      byPlan[f.plan_id].push({ plan_id: f.plan_id, key, value: f.value });
    });
    setFeatures(byPlan);
  };

  const featureLabel = (key: string, value: any) => {
    switch (key) {
      case 'billing.invoices_unlimited': return `Factures illimitées ${value?.enabled ? '✅' : '❌'}`;
      case 'billing.max_invoices_per_day': return `Max factures/jour: ${value?.value ?? '-'}`;
      case 'billing.invoice_edit': return `Modification facture ${value?.enabled ? '✅' : '❌'}`;
      case 'billing.pdf_watermark': return `Watermark PDF ${value?.enabled ? '✅' : '❌'}`;
      case 'users.max_users': return `Utilisateurs max: ${value?.value ?? '-'}`;
      case 'stock.readonly': return `Stock lecture seule ${value?.enabled ? '✅' : '❌'}`;
      case 'stock.manage_products': return `Gestion produits ${value?.enabled ? '✅' : '❌'}`;
      case 'stock.stock_alerts': return `Alertes stock ${value?.enabled ? '✅' : '❌'}`;
      case 'export.csv': return `Export CSV ${value?.enabled ? '✅' : '❌'}`;
      case 'reports.access': return `Accès rapports ${value?.enabled ? '✅' : '❌'}`;
      case 'accounting.access': return `Module comptable ${value?.enabled ? '✅' : '❌'}`;
      default: return key;
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">Tarifs</h1>
        <p className="text-muted-foreground">Choisissez le plan adapté à votre PME. Essai gratuit 15 jours.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p, idx) => (
          <Card key={p.id} className={`transition hover:shadow-lg ${idx === 2 ? 'ring-2 ring-primary' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="text-xl font-semibold">{p.name}</div>
                {idx === 2 && <Badge>Recommandé</Badge>}
              </div>
              <div className="text-3xl font-bold">{Number(p.price_year).toLocaleString('fr-FR')} <span className="text-lg">TND/an</span></div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {(features[p.id] || []).slice(0, 8).map(f => (
                  <li key={`${f.plan_id}-${f.key}`}>• {featureLabel(f.key, f.value)}</li>
                ))}
              </ul>
              <Button className="w-full mt-4">Choisir ce plan</Button>
              <p className="text-xs text-muted-foreground mt-2">Essai gratuit 15 jours</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
