import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Truck, FileText, BadgeDollarSign, TrendingUp, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { logger } from '@/lib/logger';
import { InvoiceStatus } from '@/lib/documentStatus';

interface DashboardStats {
  totalClients: number;
  totalSuppliers: number;
  totalInvoices: number;
  totalRevenue: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  revenueToday: number;
  revenueMonth: number;
  revenueYear: number;
}

interface TopClient {
  name: string;
  total: number;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    totalSuppliers: 0,
    totalInvoices: 0,
    totalRevenue: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
    revenueToday: 0,
    revenueMonth: 0,
    revenueYear: 0,
  });
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');
      const yearStart = format(startOfYear(today), 'yyyy-MM-dd');
      const yearEnd = format(endOfYear(today), 'yyyy-MM-dd');

      const [clientsRes, suppliersRes, invoicesRes] = await Promise.all([
        supabase.from('clients').select('id, name', { count: 'exact' }),
        supabase.from('suppliers').select('id', { count: 'exact', head: true }),
        supabase.from('invoices').select('*, clients(name)'),
      ]);

      const invoices = invoicesRes.data || [];
      const clients = clientsRes.data || [];
      
      const paidInvoices = invoices.filter((i: any) => i.status === 'paid');
      const pendingInvoices = invoices.filter((i: any) => i.status === 'unpaid' || i.status === 'partial' || i.status === 'overdue');
      const overdueInvoices = invoices.filter((i: any) => i.status === 'overdue');
      
      const totalRevenue = paidInvoices.reduce((sum, i) => sum + Number(i.total), 0);
      
      // Revenue by period
      const revenueToday = paidInvoices
        .filter(i => i.issue_date === todayStr)
        .reduce((sum, i) => sum + Number(i.total), 0);
      
      const revenueMonth = paidInvoices
        .filter(i => i.issue_date >= monthStart && i.issue_date <= monthEnd)
        .reduce((sum, i) => sum + Number(i.total), 0);
      
      const revenueYear = paidInvoices
        .filter(i => i.issue_date >= yearStart && i.issue_date <= yearEnd)
        .reduce((sum, i) => sum + Number(i.total), 0);

      // Top 5 clients by revenue
      const clientRevenue: Record<string, { name: string; total: number }> = {};
      paidInvoices.forEach(invoice => {
        if (invoice.client_id && invoice.clients) {
          const clientName = (invoice.clients as { name: string }).name;
          if (!clientRevenue[invoice.client_id]) {
            clientRevenue[invoice.client_id] = { name: clientName, total: 0 };
          }
          clientRevenue[invoice.client_id].total += Number(invoice.total);
        }
      });
      
      const top5 = Object.values(clientRevenue)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
      setTopClients(top5);

      // Monthly revenue for the last 6 months
      const monthlyData: MonthlyRevenue[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(today, i);
        const mStart = format(startOfMonth(date), 'yyyy-MM-dd');
        const mEnd = format(endOfMonth(date), 'yyyy-MM-dd');
        const revenue = paidInvoices
          .filter(inv => inv.issue_date >= mStart && inv.issue_date <= mEnd)
          .reduce((sum, inv) => sum + Number(inv.total), 0);
        monthlyData.push({
          month: format(date, 'MMM', { locale: fr }),
          revenue,
        });
      }
      setMonthlyRevenue(monthlyData);

      setStats({
        totalClients: clientsRes.count || 0,
        totalSuppliers: suppliersRes.count || 0,
        totalInvoices: invoices.length,
        totalRevenue,
        paidInvoices: paidInvoices.length,
        pendingInvoices: pendingInvoices.length,
        overdueInvoices: overdueInvoices.length,
        revenueToday,
        revenueMonth,
        revenueYear,
      });
    } catch (error) {
      logger.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: 'Clients', value: stats.totalClients, icon: Users, color: 'text-primary', bgColor: 'bg-primary/10' },
    { title: 'Fournisseurs', value: stats.totalSuppliers, icon: Truck, color: 'text-primary', bgColor: 'bg-primary/10' },
    { title: 'Factures', value: stats.totalInvoices, icon: FileText, color: 'text-primary', bgColor: 'bg-primary/10' },
    { title: 'CA Total', value: `${stats.totalRevenue.toLocaleString('fr-FR')} DT`, icon: BadgeDollarSign, color: 'text-primary', bgColor: 'bg-primary/10' },
  ];

  const revenueCards = [
    { title: "CA Aujourd'hui", value: `${stats.revenueToday.toLocaleString('fr-FR')} DT` },
    { title: 'CA ce mois', value: `${stats.revenueMonth.toLocaleString('fr-FR')} DT` },
    { title: 'CA cette année', value: `${stats.revenueYear.toLocaleString('fr-FR')} DT` },
  ];

  const invoiceStats = [
    { title: 'Payées', value: stats.paidInvoices, icon: CheckCircle, color: 'text-primary' },
    { title: 'En attente', value: stats.pendingInvoices, icon: Clock, color: 'text-muted-foreground' },
    { title: 'En retard', value: stats.overdueInvoices, icon: AlertTriangle, color: 'text-destructive', alert: stats.overdueInvoices > 0 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tableau de bord</h1>
        <p className="text-muted-foreground">Vue d'ensemble de votre activité</p>
      </div>

      {/* Main stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className={`p-2 rounded-md ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue by period */}
      <div className="grid gap-4 md:grid-cols-3">
        {revenueCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Invoice status with alerts */}
      <div className="grid gap-4 md:grid-cols-3">
        {invoiceStats.map((stat) => (
          <Card key={stat.title} className={stat.alert ? 'border-destructive bg-destructive/5' : ''}>
            <CardContent className="flex items-center gap-4 pt-6">
              <stat.icon className={`h-8 w-8 ${stat.color}`} />
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              {stat.alert && (
                <span className="ml-auto text-xs font-medium text-destructive bg-destructive/10 px-2 py-1 rounded">
                  Action requise
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts and Top Clients */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue trend chart */}
        <Card>
          <CardHeader>
            <CardTitle>Évolution du CA (6 derniers mois)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toLocaleString('fr-FR')} DT`, 'CA']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} isAnimationActive animationDuration={600} animationEasing="ease-out" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top 5 clients */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Clients par CA</CardTitle>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Aucune donnée disponible</p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topClients} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k DT`} className="text-xs" />
                    <YAxis type="category" dataKey="name" width={100} className="text-xs" />
                    <Tooltip
                      formatter={(value: number) => [`${value.toLocaleString('fr-FR')} DT`, 'CA']}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={600} animationEasing="ease-out" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
