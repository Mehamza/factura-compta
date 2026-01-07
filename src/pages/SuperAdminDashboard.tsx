import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Shield, Layers, TrendingUp, Building2, CreditCard, Eye, Settings, ChevronRight, Clock, Ban, CheckCircle, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { format, formatDistanceToNow, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { GlobalStatsCards } from '@/components/superadmin/GlobalStatsCards';
import { GlobalCharts } from '@/components/superadmin/GlobalCharts';
import { CompanyManagementModal } from '@/components/superadmin/CompanyManagementModal';

interface GlobalStats {
  totalCompanies: number;
  activeCompanies: number;
  disabledCompanies: number;
  totalUsers: number;
  totalInvoices: number;
  totalPayments: number;
  totalRevenue: number;
  activeSubscriptions: number;
  monthlyGrowth: {
    companies: number;
    users: number;
    invoices: number;
    payments: number;
  };
}

interface TimeSeriesData {
  month: string;
  invoices: number;
  payments: number;
  companies: number;
}

interface PlanDistribution {
  name: string;
  value: number;
}

interface CompanyRow {
  id: string;
  name: string;
  email: string | null;
  city: string | null;
  active: boolean;
  created_at: string;
  disabled_until: string | null;
  disabled_reason: string | null;
  disabled_at: string | null;
  plan_name: string | null;
  owner_email: string | null;
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
  const [stats, setStats] = useState<GlobalStats>({
    totalCompanies: 0,
    activeCompanies: 0,
    disabledCompanies: 0,
    totalUsers: 0,
    totalInvoices: 0,
    totalPayments: 0,
    totalRevenue: 0,
    activeSubscriptions: 0,
    monthlyGrowth: { companies: 0, users: 0, invoices: 0, payments: 0 },
  });
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [planDistribution, setPlanDistribution] = useState<PlanDistribution[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  
  // Company management modal
  const [selectedCompany, setSelectedCompany] = useState<CompanyRow | null>(null);
  const [showCompanyModal, setShowCompanyModal] = useState(false);

  useEffect(() => {
    fetchGlobalStats();
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
      // Get companies with deactivation fields
      const { data: companiesData, error } = await supabase
        .from('companies')
        .select('id, name, email, city, active, created_at, disabled_until, disabled_reason, disabled_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get company plans
      const { data: companyPlans } = await supabase
        .from('company_plans')
        .select('company_id, plans(name)')
        .eq('active', true);

      // Get user counts and owner emails per company
      const { data: companyUsers } = await supabase
        .from('company_users')
        .select('company_id, user_id, role');

      // Get profiles for owner emails
      const adminUserIds = (companyUsers || [])
        .filter((cu: any) => cu.role === 'company_admin')
        .map((cu: any) => cu.user_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email')
        .in('user_id', adminUserIds);

      // Map data
      const planMap = new Map<string, string>();
      (companyPlans || []).forEach((cp: any) => {
        if (cp.company_id && cp.plans?.name) {
          planMap.set(cp.company_id, cp.plans.name);
        }
      });

      const userCountMap = new Map<string, number>();
      const ownerEmailMap = new Map<string, string>();
      
      (companyUsers || []).forEach((cu: any) => {
        userCountMap.set(cu.company_id, (userCountMap.get(cu.company_id) || 0) + 1);
        if (cu.role === 'company_admin') {
          const profile = (profiles || []).find((p: any) => p.user_id === cu.user_id);
          if (profile?.email) {
            ownerEmailMap.set(cu.company_id, profile.email);
          }
        }
      });

      const enrichedCompanies: CompanyRow[] = (companiesData || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        city: c.city,
        active: c.active,
        created_at: c.created_at,
        disabled_until: c.disabled_until,
        disabled_reason: c.disabled_reason,
        disabled_at: c.disabled_at,
        plan_name: planMap.get(c.id) || null,
        owner_email: ownerEmailMap.get(c.id) || null,
        users_count: userCountMap.get(c.id) || 0,
      }));

      setCompanies(enrichedCompanies);
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setCompaniesLoading(false);
    }
  };

  const fetchGlobalStats = async () => {
    try {
      // Fetch companies with status
      const { data: companiesData, count: companyCount } = await supabase
        .from('companies')
        .select('active, created_at', { count: 'exact' });

      const activeCompanies = (companiesData || []).filter((c: any) => c.active).length;
      const disabledCompanies = (companyCount || 0) - activeCompanies;

      // Fetch users
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch invoices
      const { count: invoiceCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true });

      // Fetch payments
      const { data: paymentsData, count: paymentCount } = await supabase
        .from('payments')
        .select('amount, created_at', { count: 'exact' });

      // Calculate total payment amounts (platform revenue from subscriptions)
      const { data: activePlans, count: subscriptionCount } = await supabase
        .from('company_plans')
        .select('*, plans(*)', { count: 'exact' })
        .eq('active', true);

      const totalRevenue = (activePlans || []).reduce((sum, cp) => {
        const plan = cp.plans as { price_year?: number } | null;
        return sum + (plan?.price_year || 0);
      }, 0);

      // Calculate monthly growth rates
      const lastMonth = subMonths(new Date(), 1);
      const lastMonthStr = lastMonth.toISOString();

      const { count: lastMonthCompanies } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', lastMonthStr);

      const { count: lastMonthUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', lastMonthStr);

      const { count: lastMonthInvoices } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', lastMonthStr);

      const { count: lastMonthPayments } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', lastMonthStr);

      const calcGrowth = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      setStats({
        totalCompanies: companyCount || 0,
        activeCompanies,
        disabledCompanies,
        totalUsers: userCount || 0,
        totalInvoices: invoiceCount || 0,
        totalPayments: paymentCount || 0,
        totalRevenue,
        activeSubscriptions: subscriptionCount || 0,
        monthlyGrowth: {
          companies: calcGrowth(companyCount || 0, lastMonthCompanies || 0),
          users: calcGrowth(userCount || 0, lastMonthUsers || 0),
          invoices: calcGrowth(invoiceCount || 0, lastMonthInvoices || 0),
          payments: calcGrowth(paymentCount || 0, lastMonthPayments || 0),
        },
      });

      // Fetch time series data for charts
      await fetchTimeSeriesData();
      await fetchPlanDistribution();
    } catch (error) {
      console.error('Error fetching global stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeSeriesData = async () => {
    try {
      // Get data for last 6 months
      const months: TimeSeriesData[] = [];
      
      for (let i = 5; i >= 0; i--) {
        const monthStart = subMonths(new Date(), i);
        const monthEnd = subMonths(new Date(), i - 1);
        const monthKey = format(monthStart, 'MMM yy', { locale: fr });

        // Count invoices for this month
        const { count: invoiceCount } = await supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', monthStart.toISOString())
          .lt('created_at', monthEnd.toISOString());

        // Count payments for this month
        const { count: paymentCount } = await supabase
          .from('payments')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', monthStart.toISOString())
          .lt('created_at', monthEnd.toISOString());

        // Count new companies for this month
        const { count: companyCount } = await supabase
          .from('companies')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', monthStart.toISOString())
          .lt('created_at', monthEnd.toISOString());

        months.push({
          month: monthKey,
          invoices: invoiceCount || 0,
          payments: paymentCount || 0,
          companies: companyCount || 0,
        });
      }

      setTimeSeriesData(months);
    } catch (error) {
      console.error('Error fetching time series data:', error);
    }
  };

  const fetchPlanDistribution = async () => {
    try {
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
    } catch (error) {
      console.error('Error fetching plan distribution:', error);
    }
  };

  const assignPlanToCompany = async (companyId: string, planId: string) => {
    try {
      await supabase
        .from('company_plans')
        .update({ active: false })
        .eq('company_id', companyId);

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
      fetchGlobalStats();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    }
  };

  const handleCompanyClick = (company: CompanyRow) => {
    setSelectedCompany(company);
    setShowCompanyModal(true);
  };

  const filteredCompanies = companies.filter(c => {
    const matchesSearch = companySearch === '' || 
      c.name.toLowerCase().includes(companySearch.toLowerCase()) ||
      c.email?.toLowerCase().includes(companySearch.toLowerCase()) ||
      c.owner_email?.toLowerCase().includes(companySearch.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && c.active) ||
      (statusFilter === 'disabled' && !c.active);

    return matchesSearch && matchesStatus;
  });

  const getCompanyStatusBadge = (company: CompanyRow) => {
    if (company.active) {
      return (
        <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          Actif
        </Badge>
      );
    }
    
    if (company.disabled_until) {
      return (
        <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          <Clock className="h-3 w-3 mr-1" />
          Temp. ({formatDistanceToNow(new Date(company.disabled_until), { locale: fr })})
        </Badge>
      );
    }

    return (
      <Badge variant="destructive">
        <Ban className="h-3 w-3 mr-1" />
        Permanent
      </Badge>
    );
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
        <p className="text-muted-foreground">Vue d'ensemble globale de la plateforme et gestion des entreprises.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 rounded-lg bg-muted p-1">
          <TabsTrigger value="overview" className="w-full justify-center gap-2 whitespace-nowrap px-2 sm:px-3">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Vue d'ensemble</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="w-full justify-center gap-2 whitespace-nowrap px-2 sm:px-3">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Utilisateurs</span>
          </TabsTrigger>
          <TabsTrigger value="companies" className="w-full justify-center gap-2 whitespace-nowrap px-2 sm:px-3">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Entreprises</span>
          </TabsTrigger>
          <TabsTrigger value="plans" className="w-full justify-center gap-2 whitespace-nowrap px-2 sm:px-3">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Plans</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Global Stats Cards */}
          <GlobalStatsCards stats={stats} loading={loading} />

          {/* Charts */}
          <GlobalCharts timeSeriesData={timeSeriesData} loading={loading} />

          {/* Quick Access & Plan Distribution */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Quick Access Cards */}
            <Card>
              <CardHeader>
                <CardTitle>Accès rapide</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div 
                  className="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50" 
                  onClick={() => setActiveTab('users')}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">Utilisateurs</div>
                      <div className="text-sm text-muted-foreground">Gérer tous les utilisateurs</div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <div 
                  className="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50" 
                  onClick={() => setActiveTab('companies')}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">Entreprises</div>
                      <div className="text-sm text-muted-foreground">Activer/Désactiver les comptes</div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <div 
                  className="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50" 
                  onClick={() => setActiveTab('plans')}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Layers className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">Plans</div>
                      <div className="text-sm text-muted-foreground">Gérer les abonnements</div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
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
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={planDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={70}
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
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    Aucun abonnement actif
                  </div>
                )}
              </CardContent>
            </Card>
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
                    <div className="text-3xl font-bold" style={{ color: 'hsl(var(--chart-2))' }}>{stats.activeSubscriptions}</div>
                    <p className="text-sm text-muted-foreground">Avec abonnement actif</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-3xl font-bold" style={{ color: 'hsl(var(--chart-3))' }}>{stats.totalCompanies}</div>
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
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Gestion des entreprises</CardTitle>
                  <CardDescription>Activer, désactiver et gérer les comptes entreprises</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                    {stats.activeCompanies} actives
                  </Badge>
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                    {stats.disabledCompanies} désactivées
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par nom, email..."
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v: 'all' | 'active' | 'disabled') => setStatusFilter(v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrer par statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="active">Actives</SelectItem>
                    <SelectItem value="disabled">Désactivées</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Companies Table */}
              {companiesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entreprise</TableHead>
                      <TableHead>Propriétaire</TableHead>
                      <TableHead>Utilisateurs</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Créée le</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Aucune entreprise trouvée
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCompanies.map((company) => (
                        <TableRow 
                          key={company.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleCompanyClick(company)}
                        >
                          <TableCell className="font-medium">
                            <div>
                              <div>{company.name}</div>
                              {company.city && (
                                <div className="text-xs text-muted-foreground">{company.city}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{company.owner_email || '-'}</span>
                          </TableCell>
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
                          <TableCell>{getCompanyStatusBadge(company)}</TableCell>
                          <TableCell>
                            {format(new Date(company.created_at), 'dd/MM/yyyy', { locale: fr })}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={plans.find(p => p.name === company.plan_name)?.id || ''}
                              onValueChange={(value) => assignPlanToCompany(company.id, value)}
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue placeholder="Plan..." />
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

      {/* Company Management Modal */}
      <CompanyManagementModal
        company={selectedCompany}
        open={showCompanyModal}
        onOpenChange={setShowCompanyModal}
        onStatusChange={() => {
          fetchCompanies();
          fetchGlobalStats();
        }}
      />
    </div>
  );
}
