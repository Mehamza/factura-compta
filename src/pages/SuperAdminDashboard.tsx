import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Shield, Layers, TrendingUp, Building2, CreditCard, Eye, Settings, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

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

interface CompanyRow {
  id: string;
  name: string;
  email: string | null;
  city: string | null;
  active: boolean;
  created_at: string;
  plan_name: string | null;
  users_count: number;
}

interface Plan {
  id: string;
  name: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0,
    totalCompanies: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
  });
  const [planDistribution, setPlanDistribution] = useState<PlanDistribution[]>([]);
  const [userGrowth, setUserGrowth] = useState<UserGrowth[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  useEffect(() => {
    fetchPlatformStats();
    fetchPlans();
  }, []);

  useEffect(() => {
    if (activeTab === 'companies') {
      fetchCompanies();
    }
  }, [activeTab]);

  const fetchPlans = async () => {
    const { data } = await supabase
      .from('plans')
      .select('id, name')
      .eq('active', true)
      .order('display_order');
    setPlans((data || []) as Plan[]);
  };

  const fetchCompanies = async () => {
    setCompaniesLoading(true);
    try {
      // Get companies
      const { data: companiesData, error } = await supabase
        .from('companies')
        .select('id, name, email, city, active, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get company plans
      const { data: companyPlans } = await supabase
        .from('company_plans')
        .select('company_id, plans(name)')
        .eq('active', true);

      // Get user counts per company
      const { data: companyUsers } = await supabase
        .from('company_users')
        .select('company_id');

      // Map plan names to companies
      const planMap = new Map<string, string>();
      (companyPlans || []).forEach((cp: any) => {
        if (cp.company_id && cp.plans?.name) {
          planMap.set(cp.company_id, cp.plans.name);
        }
      });

      // Count users per company
      const userCountMap = new Map<string, number>();
      (companyUsers || []).forEach((cu: any) => {
        userCountMap.set(cu.company_id, (userCountMap.get(cu.company_id) || 0) + 1);
      });

      const enrichedCompanies: CompanyRow[] = (companiesData || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        city: c.city,
        active: c.active,
        created_at: c.created_at,
        plan_name: planMap.get(c.id) || null,
        users_count: userCountMap.get(c.id) || 0,
      }));

      setCompanies(enrichedCompanies);
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setCompaniesLoading(false);
    }
  };

  const fetchPlatformStats = async () => {
    try {
      // Fetch total users (profiles)
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch companies count
      const { count: companyCount } = await supabase
        .from('companies')
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
      const { data: plansData } = await supabase
        .from('plans')
        .select('id, name')
        .eq('active', true);

      if (plansData) {
        const distribution: PlanDistribution[] = [];
        for (const plan of plansData) {
          const { count } = await supabase
            .from('company_plans')
            .select('*', { count: 'exact', head: true })
            .eq('plan_id', plan.id)
            .eq('active', true);
          distribution.push({ name: plan.name, value: count || 0 });
        }
        setPlanDistribution(distribution.filter(d => d.value > 0));
      }

      // User growth data
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

  const assignPlanToCompany = async (companyId: string, planId: string) => {
    try {
      // First deactivate existing plans for this company
      await supabase
        .from('company_plans')
        .update({ active: false })
        .eq('company_id', companyId);

      // Get the company's owner user_id from company_users
      const { data: companyUser } = await supabase
        .from('company_users')
        .select('user_id')
        .eq('company_id', companyId)
        .eq('role', 'company_admin')
        .limit(1)
        .single();

      if (!companyUser) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Aucun administrateur trouvé pour cette entreprise' });
        return;
      }

      // Create new plan assignment
      const { error } = await supabase
        .from('company_plans')
        .insert({
          company_id: companyId,
          plan_id: planId,
          user_id: companyUser.user_id,
          active: true,
          started_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({ title: 'Succès', description: 'Plan attribué à l\'entreprise' });
      fetchCompanies();
      fetchPlatformStats();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Vue d'ensemble</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Utilisateurs</span>
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Entreprises</span>
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-2">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Plans</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
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
            <div className="grid gap-4 md:grid-cols-3">
              <Card 
                className="cursor-pointer transition-colors hover:bg-accent/50" 
                onClick={() => setActiveTab('users')}
              >
                <CardHeader className="flex flex-row items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">Utilisateurs</CardTitle>
                    <CardDescription>Gérer tous les utilisateurs</CardDescription>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
              </Card>
              <Card 
                className="cursor-pointer transition-colors hover:bg-accent/50" 
                onClick={() => setActiveTab('companies')}
              >
                <CardHeader className="flex flex-row items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">Entreprises</CardTitle>
                    <CardDescription>Voir toutes les entreprises</CardDescription>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
              </Card>
              <Card 
                className="cursor-pointer transition-colors hover:bg-accent/50" 
                onClick={() => setActiveTab('plans')}
              >
                <CardHeader className="flex flex-row items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Layers className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">Plans</CardTitle>
                    <CardDescription>Gérer les abonnements</CardDescription>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestion des utilisateurs</CardTitle>
                <CardDescription>Voir, gérer et impersonner tous les utilisateurs</CardDescription>
              </div>
              <Button onClick={() => navigate('/hamzafacturation/utilisateurs')}>
                <Eye className="h-4 w-4 mr-2" />
                Ouvrir la gestion complète
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-3xl font-bold text-primary">{stats.totalUsers}</div>
                    <p className="text-sm text-muted-foreground">Total utilisateurs</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-3xl font-bold text-chart-2">{stats.activeSubscriptions}</div>
                    <p className="text-sm text-muted-foreground">Avec abonnement actif</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-3xl font-bold text-chart-3">{stats.totalCompanies}</div>
                    <p className="text-sm text-muted-foreground">Entreprises créées</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Toutes les entreprises</CardTitle>
                <CardDescription>Vue d'ensemble et attribution des plans</CardDescription>
              </div>
              <Badge variant="secondary">{companies.length} entreprise{companies.length > 1 ? 's' : ''}</Badge>
            </CardHeader>
            <CardContent>
              {companiesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entreprise</TableHead>
                      <TableHead>Ville</TableHead>
                      <TableHead>Utilisateurs</TableHead>
                      <TableHead>Plan actuel</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date création</TableHead>
                      <TableHead>Attribuer plan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Aucune entreprise trouvée
                        </TableCell>
                      </TableRow>
                    ) : (
                      companies.map((company) => (
                        <TableRow key={company.id}>
                          <TableCell className="font-medium">
                            <div>
                              <div>{company.name}</div>
                              {company.email && (
                                <div className="text-xs text-muted-foreground">{company.email}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{company.city || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{company.users_count}</Badge>
                          </TableCell>
                          <TableCell>
                            {company.plan_name ? (
                              <Badge>{company.plan_name}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">Aucun</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {company.active ? (
                              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                                Actif
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Inactif</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(new Date(company.created_at), 'dd MMM yyyy', { locale: fr })}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={plans.find(p => p.name === company.plan_name)?.id || ''}
                              onValueChange={(value) => assignPlanToCompany(company.id, value)}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Choisir..." />
                              </SelectTrigger>
                              <SelectContent>
                                {plans.map((plan) => (
                                  <SelectItem key={plan.id} value={plan.id}>
                                    {plan.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestion des plans</CardTitle>
                <CardDescription>Configurer les plans et leurs fonctionnalités</CardDescription>
              </div>
              <Button onClick={() => navigate('/hamzafacturation/plans')}>
                <Settings className="h-4 w-4 mr-2" />
                Ouvrir la configuration complète
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {planDistribution.map((plan, index) => (
                  <Card key={plan.name}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{plan.name}</span>
                      </div>
                      <div className="text-2xl font-bold">{plan.value}</div>
                      <p className="text-sm text-muted-foreground">abonnement{plan.value > 1 ? 's' : ''} actif{plan.value > 1 ? 's' : ''}</p>
                    </CardContent>
                  </Card>
                ))}
                {planDistribution.length === 0 && (
                  <Card className="col-span-full">
                    <CardContent className="pt-6 text-center text-muted-foreground">
                      Aucun plan avec des abonnements actifs
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
