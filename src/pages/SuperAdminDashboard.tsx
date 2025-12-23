import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Shield, Layers, TrendingUp, Building2, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface PlatformStats {
  totalUsers: number;
  totalCompanies: number;
  activeSubscriptions: number;
  totalRevenue: number;
}

interface PlanDistribution {
  name: string;
  value: number;
}

interface UserGrowth {
  month: string;
  users: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0,
    totalCompanies: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
  });
  const [planDistribution, setPlanDistribution] = useState<PlanDistribution[]>([]);
  const [userGrowth, setUserGrowth] = useState<UserGrowth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlatformStats();
  }, []);

  const fetchPlatformStats = async () => {
    try {
      // Fetch total users (profiles)
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch company settings (as companies)
      const { count: companyCount } = await supabase
        .from('company_settings')
        .select('*', { count: 'exact', head: true });

      // Fetch active subscriptions
      const { data: activePlans, count: subscriptionCount } = await supabase
        .from('company_plans')
        .select('*, plans(*)', { count: 'exact' })
        .eq('active', true);

      // Calculate total revenue from active plans
      const totalRevenue = (activePlans || []).reduce((sum, cp) => {
        const plan = cp.plans as { price_year?: number } | null;
        return sum + (plan?.price_year || 0);
      }, 0);

      setStats({
        totalUsers: userCount || 0,
        totalCompanies: companyCount || 0,
        activeSubscriptions: subscriptionCount || 0,
        totalRevenue,
      });

      // Fetch plan distribution
      const { data: plans } = await supabase
        .from('plans')
        .select('id, name')
        .eq('active', true);

      if (plans) {
        const distribution: PlanDistribution[] = [];
        for (const plan of plans) {
          const { count } = await supabase
            .from('company_plans')
            .select('*', { count: 'exact', head: true })
            .eq('plan_id', plan.id)
            .eq('active', true);
          distribution.push({ name: plan.name, value: count || 0 });
        }
        setPlanDistribution(distribution.filter(d => d.value > 0));
      }

      // Simulate user growth data (in real app, this would come from analytics)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('created_at')
        .order('created_at', { ascending: true });

      if (profiles) {
        const monthlyGrowth: Record<string, number> = {};
        profiles.forEach(p => {
          const date = new Date(p.created_at);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthlyGrowth[monthKey] = (monthlyGrowth[monthKey] || 0) + 1;
        });

        // Get last 6 months
        const months = Object.keys(monthlyGrowth).sort().slice(-6);
        let cumulative = 0;
        const growthData = months.map(month => {
          cumulative += monthlyGrowth[month];
          const [year, m] = month.split('-');
          const monthName = new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString('fr-FR', { month: 'short' });
          return { month: monthName, users: cumulative };
        });
        setUserGrowth(growthData);
      }
    } catch (error) {
      console.error('Error fetching platform stats:', error);
    } finally {
      setLoading(false);
    }
  };

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
        <h1 className="text-3xl font-bold">Espace Super Admin</h1>
        <p className="text-muted-foreground">Vue d'ensemble de la plateforme et gestion globale.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Utilisateurs inscrits</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entreprises</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCompanies}</div>
            <p className="text-xs text-muted-foreground">Entreprises configurées</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abonnements</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Abonnements actifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenus</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRevenue.toLocaleString('fr-FR')} DT</div>
            <p className="text-xs text-muted-foreground">Revenus annuels</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* User Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Croissance des utilisateurs</CardTitle>
            <CardDescription>Évolution du nombre d'utilisateurs sur les derniers mois</CardDescription>
          </CardHeader>
          <CardContent>
            {userGrowth.length > 0 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={userGrowth}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="users" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                      name="Utilisateurs"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Pas de données disponibles
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition des plans</CardTitle>
            <CardDescription>Distribution des abonnements par type de plan</CardDescription>
          </CardHeader>
          <CardContent>
            {planDistribution.length > 0 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {planDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Aucun abonnement actif
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Accès rapide</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card 
            className="cursor-pointer transition-colors hover:bg-accent/50" 
            onClick={() => navigate('/hamzafacturation/utilisateurs')}
          >
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Utilisateurs globaux</CardTitle>
                <CardDescription>Voir, gérer et impersonner tous les utilisateurs</CardDescription>
              </div>
            </CardHeader>
          </Card>
          <Card 
            className="cursor-pointer transition-colors hover:bg-accent/50" 
            onClick={() => navigate('/hamzafacturation/plans')}
          >
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Plans d'abonnement</CardTitle>
                <CardDescription>Gérer les plans et les permissions</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
