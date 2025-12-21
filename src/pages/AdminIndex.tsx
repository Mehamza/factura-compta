import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function AdminIndex() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [revenue, setRevenue] = useState<number | null>(null);
  const [unpaidCount, setUnpaidCount] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: products } = await supabase.from('products').select('quantity, min_stock');
      const low = (products || []).filter(p => Number(p.quantity) <= Number(p.min_stock));
      setLowStockCount(low.length);

      // Compute CA total (sum of total for invoices with status = 'paid')
      const { data: invoicesPaid } = await supabase
        .from('invoices')
        .select('total, status')
        .eq('status', 'paid');
      const totalRevenue = (invoicesPaid || []).reduce((sum, inv: any) => sum + Number(inv.total || 0), 0);
      setRevenue(totalRevenue);

      // Count unpaid invoices (status sent or overdue)
      const { data: invoicesUnpaid } = await supabase
        .from('invoices')
        .select('id, status')
        .in('status', ['sent', 'overdue']);
      setUnpaidCount((invoicesUnpaid || []).length);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Administration</h1>
          <p className="text-muted-foreground">Espace réservé à l’administrateur de l’application.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer" onClick={() => navigate('/invoices')}>
          <CardHeader>Chiffre d’affaires total</CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{revenue === null ? '…' : revenue.toLocaleString('fr-FR') + ' TND'}</div>
            <p className="text-muted-foreground text-sm">Voir les factures et paiements</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer" onClick={() => navigate('/invoices')}>
          <CardHeader>Factures impayées</CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{unpaidCount === null ? '…' : unpaidCount}</div>
            <p className="text-muted-foreground text-sm">Consulter et relancer</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer" onClick={() => navigate('/stock/produits')}>
          <CardHeader>Alertes stock faible</CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-semibold">{loading ? '…' : lowStockCount}</div>
              {!loading && (lowStockCount > 0 ? <Badge variant="destructive">Attention</Badge> : <Badge variant="outline">OK</Badge>)}
            </div>
            <p className="text-muted-foreground text-sm">Produits sous le minimum</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>Gestion globale des utilisateurs</CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground text-sm">Voir tous les utilisateurs, impersonnation, suppression</p>
            <Button onClick={() => navigate('/hamzafacturation/utilisateurs')}>Ouvrir</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>Gestion des utilisateurs entreprise</CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground text-sm">Ajouter, modifier, supprimer et gérer les rôles</p>
            <Button onClick={() => navigate('/settings/utilisateurs')}>Ouvrir</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>Gestion du stock</CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/stock/produits')}>Produits</Button>
              <Button variant="outline" onClick={() => navigate('/stock/mouvements')}>Mouvements</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>Facturation</CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/invoices')}>Factures</Button>
              <Button variant="outline" onClick={() => navigate('/documents')}>Documents</Button>
              <Button variant="outline" onClick={() => navigate('/payments')}>Paiements</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>Rapports</CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground text-sm">Rapports financiers et exports</p>
            <Button onClick={() => navigate('/reports')}>Ouvrir</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>Paramètres entreprise</CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground text-sm">Informations, devise par défaut, TVA</p>
            <Button onClick={() => navigate('/settings')}>Ouvrir</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
