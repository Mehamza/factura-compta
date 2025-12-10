import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Truck, FileText, Euro, TrendingUp, Clock, CheckCircle } from 'lucide-react';

interface DashboardStats {
  totalClients: number;
  totalSuppliers: number;
  totalInvoices: number;
  totalRevenue: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
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
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const [clientsRes, suppliersRes, invoicesRes] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('suppliers').select('id', { count: 'exact', head: true }),
        supabase.from('invoices').select('*'),
      ]);

      const invoices = invoicesRes.data || [];
      const paidInvoices = invoices.filter(i => i.status === 'paid');
      const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'draft');
      const overdueInvoices = invoices.filter(i => i.status === 'overdue');
      const totalRevenue = paidInvoices.reduce((sum, i) => sum + Number(i.total), 0);

      setStats({
        totalClients: clientsRes.count || 0,
        totalSuppliers: suppliersRes.count || 0,
        totalInvoices: invoices.length,
        totalRevenue,
        paidInvoices: paidInvoices.length,
        pendingInvoices: pendingInvoices.length,
        overdueInvoices: overdueInvoices.length,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Clients',
      value: stats.totalClients,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Fournisseurs',
      value: stats.totalSuppliers,
      icon: Truck,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Factures',
      value: stats.totalInvoices,
      icon: FileText,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Chiffre d\'affaires',
      value: `${stats.totalRevenue.toLocaleString('fr-FR')} €`,
      icon: Euro,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
  ];

  const invoiceStats = [
    {
      title: 'Factures payées',
      value: stats.paidInvoices,
      icon: CheckCircle,
      color: 'text-green-500',
    },
    {
      title: 'En attente',
      value: stats.pendingInvoices,
      icon: Clock,
      color: 'text-amber-500',
    },
    {
      title: 'En retard',
      value: stats.overdueInvoices,
      icon: TrendingUp,
      color: 'text-red-500',
    },
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
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

      <div className="grid gap-4 md:grid-cols-3">
        {invoiceStats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="flex items-center gap-4 pt-6">
              <stat.icon className={`h-8 w-8 ${stat.color}`} />
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
