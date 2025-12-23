import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { logger } from '@/lib/logger';

export default function AdminIndex() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [revenue, setRevenue] = useState<number | null>(null);
  const [unpaidCount, setUnpaidCount] = useState<number | null>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState<Array<{ month: string; revenue: number }>>([]);
  const [topClients, setTopClients] = useState<Array<{ name: string; total: number }>>([]);
  const [invoiceStatusCounts, setInvoiceStatusCounts] = useState<{ paid: number; sent: number; overdue: number; draft: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: products } = await supabase.from('products').select('quantity, min_stock');
        const low = (products || []).filter((p) => Number(p.quantity) <= Number(p.min_stock));
        setLowStockCount(low.length);

        // Fetch all invoices (limited to 2000)
        const { data: invoices } = await supabase.from('invoices').select('id, total, status, issue_date, clients(name), client_id');
        const allInvoices = invoices || [];

        // Total revenue (paid only)
        const paidInvoices = allInvoices.filter((i: any) => i.status === 'paid');
        const totalRevenue = paidInvoices.reduce((sum: number, inv: any) => sum + Number(inv.total || 0), 0);
        setRevenue(totalRevenue);

        // unpaid count (sent or overdue)
        const unpaid = allInvoices.filter((i: any) => i.status === 'sent' || i.status === 'overdue');
        setUnpaidCount(unpaid.length);

        // invoice status counts
        const statusCounts = {
          paid: allInvoices.filter((i: any) => i.status === 'paid').length,
          sent: allInvoices.filter((i: any) => i.status === 'sent').length,
          overdue: allInvoices.filter((i: any) => i.status === 'overdue').length,
          draft: allInvoices.filter((i: any) => i.status === 'draft').length,
        };
        setInvoiceStatusCounts(statusCounts);

        // Monthly revenue last 6 months
        const months: Array<{ month: string; revenue: number }> = [];
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = subMonths(today, i);
          const start = format(startOfMonth(d), 'yyyy-MM-dd');
          const end = format(endOfMonth(d), 'yyyy-MM-dd');
          const revenueForMonth = paidInvoices
            .filter((inv: any) => inv.issue_date >= start && inv.issue_date <= end)
            .reduce((sum: number, inv: any) => sum + Number(inv.total || 0), 0);
          months.push({ month: format(d, 'MMM', { locale: fr }), revenue: revenueForMonth });
        }
        setMonthlyRevenue(months);

        // Top clients by revenue
        const clientMap: Record<string, { name: string; total: number }> = {};
        paidInvoices.forEach((inv: any) => {
          const cid = inv.client_id || 'unknown';
          const name = inv.clients ? inv.clients.name : '—';
          if (!clientMap[cid]) clientMap[cid] = { name, total: 0 };
          clientMap[cid].total += Number(inv.total || 0);
        });
        const top = Object.values(clientMap).sort((a, b) => b.total - a.total).slice(0, 6);
        setTopClients(top);
      } catch (err) {
        logger.error('AdminIndex load error', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Administration</h1>
          <p className="text-muted-foreground">Vue globale de l’application et des métriques clés.</p>
        </div>
      </div>

      {/* Top stat cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>CA total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{revenue === null ? '…' : revenue.toLocaleString('fr-FR') + ' TND'}</div>
            <p className="text-muted-foreground text-sm">Revenus encaissés</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Factures impayées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{unpaidCount === null ? '…' : unpaidCount}</div>
            <p className="text-muted-foreground text-sm">À relancer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertes stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-semibold">{loading ? '…' : lowStockCount}</div>
              {!loading && (lowStockCount > 0 ? <Badge variant="destructive">Attention</Badge> : <Badge variant="outline">OK</Badge>)}
            </div>
            <p className="text-muted-foreground text-sm">Produits sous le minimum</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Utilisateurs globaux</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Gérer les comptes et l’impersonation</p>
            <div className="mt-2">
              <Button onClick={() => navigate('/hamzafacturation/utilisateurs')}>Ouvrir</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts section */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Évolution du CA (6 mois)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-48 flex items-center justify-center">Chargement…</div>
            ) : (
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyRevenue} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Répartition factures</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !invoiceStatusCounts ? (
              <div className="h-48 flex items-center justify-center">Chargement…</div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span>Payées</span><span>{invoiceStatusCounts.paid}</span></div>
                <div className="flex justify-between text-sm"><span>Envoyées</span><span>{invoiceStatusCounts.sent}</span></div>
                <div className="flex justify-between text-sm"><span>En retard</span><span>{invoiceStatusCounts.overdue}</span></div>
                <div className="flex justify-between text-sm"><span>Brouillons</span><span>{invoiceStatusCounts.draft}</span></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top clients */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top clients</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-40 flex items-center justify-center">Chargement…</div>
            ) : (
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topClients} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#06b6d4" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={() => navigate('/hamzafacturation/utilisateurs')}>Gérer utilisateurs</Button>
            <Button variant="outline" onClick={() => navigate('/hamzafacturation/plans')}>Gérer plans</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
