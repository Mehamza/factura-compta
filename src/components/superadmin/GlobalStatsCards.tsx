import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Building2, 
  Users, 
  FileText, 
  CreditCard, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  TrendingDown 
} from 'lucide-react';

interface GlobalStats {
  totalCompanies: number;
  activeCompanies: number;
  disabledCompanies: number;
  totalUsers: number;
  totalInvoices: number;
  totalPayments: number;
  totalRevenue: number;
  monthlyGrowth: {
    companies: number;
    users: number;
    invoices: number;
    payments: number;
  };
}

interface GlobalStatsCardsProps {
  stats: GlobalStats;
  loading?: boolean;
}

export function GlobalStatsCards({ stats, loading }: GlobalStatsCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-4 w-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded mb-1" />
              <div className="h-3 w-32 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Entreprises',
      value: stats.totalCompanies,
      icon: Building2,
      description: `${stats.activeCompanies} actives, ${stats.disabledCompanies} désactivées`,
      growth: stats.monthlyGrowth.companies,
    },
    {
      title: 'Entreprises Actives',
      value: stats.activeCompanies,
      icon: CheckCircle,
      description: 'Entreprises en activité',
      color: 'text-green-600',
    },
    {
      title: 'Entreprises Désactivées',
      value: stats.disabledCompanies,
      icon: XCircle,
      description: 'Comptes suspendus',
      color: 'text-destructive',
    },
    {
      title: 'Total Utilisateurs',
      value: stats.totalUsers,
      icon: Users,
      description: 'Utilisateurs inscrits',
      growth: stats.monthlyGrowth.users,
    },
    {
      title: 'Total Factures',
      value: stats.totalInvoices,
      icon: FileText,
      description: 'Factures créées',
      growth: stats.monthlyGrowth.invoices,
    },
    {
      title: 'Total Paiements',
      value: stats.totalPayments,
      icon: CreditCard,
      description: 'Paiements enregistrés',
      growth: stats.monthlyGrowth.payments,
    },
    {
      title: 'Revenus Plateforme',
      value: `${stats.totalRevenue.toLocaleString('fr-FR')} DT`,
      icon: TrendingUp,
      description: 'Revenus des abonnements',
      isRevenue: true,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color || 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stat.color || ''}`}>
              {typeof stat.value === 'number' ? stat.value.toLocaleString('fr-FR') : stat.value}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">{stat.description}</p>
              {stat.growth !== undefined && (
                <span className={`text-xs flex items-center gap-1 ${stat.growth >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {stat.growth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {stat.growth >= 0 ? '+' : ''}{stat.growth}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
