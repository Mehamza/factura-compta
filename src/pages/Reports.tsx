import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, FileText, TrendingUp, Users } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { InvoiceStatus } from '@/lib/documentStatus';

type Invoice = Tables<'invoices'>;
type Client = Tables<'clients'>;

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  invoice_id: string | null;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export default function Reports() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [month]);

  const load = async () => {
    setLoading(true);
    const start = `${month}-01`;
    const end = `${month}-31`;

    const [invRes, allInvRes, cliRes, payRes] = await Promise.all([
      supabase.from('invoices').select('*').gte('issue_date', start).lte('issue_date', end),
      supabase.from('invoices').select('*'),
      supabase.from('clients').select('*'),
      supabase.from('payments').select('id, amount, payment_date, invoice_id').gte('payment_date', start).lte('payment_date', end),
    ]);

    setInvoices(invRes.data || []);
    setAllInvoices(allInvRes.data || []);
    setClients(cliRes.data || []);
    setPayments((payRes.data as Payment[]) || []);
    setLoading(false);
  };

  // Summary stats
  const summary = {
    issued: invoices.length,
    paid: invoices.filter((i: any) => i.status === 'paid').length,
    outstanding: invoices.filter((i: any) => i.status !== 'paid' && i.status !== InvoiceStatus.CANCELLED).length,
    overdue: invoices.filter((i: any) => i.status === 'overdue').length,
    totalRevenue: invoices.filter((i: any) => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0),
    totalPending: invoices.filter((i: any) => i.status !== 'paid').reduce((s, i) => s + Number(i.total), 0),
    totalPayments: payments.reduce((s, p) => s + Number(p.amount), 0),
  };

  // VAT Report (exclude purchase quotes)
  const vatCollected = invoices.reduce((s, i) => s + Number(i.tax_amount), 0);

  // Monthly revenue chart data (last 6 months)
  const getMonthlyData = () => {
    const data: { month: string; revenue: number; invoices: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().slice(0, 7);
      const monthInvoices = allInvoices.filter((inv: any) => inv.issue_date.startsWith(monthStr) && inv.status === 'paid');
      data.push({
        month: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        revenue: monthInvoices.reduce((s, inv) => s + Number(inv.total), 0),
        invoices: monthInvoices.length
      });
    }
    return data;
  };

  // Status distribution
  const statusData = [
    { name: 'Payées', value: invoices.filter((i: any) => i.status === 'paid').length },
    { name: 'En attente', value: invoices.filter((i: any) => i.status === 'unpaid' || i.status === 'partial').length },
    { name: 'Brouillons', value: invoices.filter(i => i.status === InvoiceStatus.DRAFT).length },
    { name: 'En retard', value: invoices.filter((i: any) => i.status === 'overdue').length },
    { name: 'Annulées', value: invoices.filter(i => i.status === InvoiceStatus.CANCELLED).length },
  ].filter(d => d.value > 0);

  // Client revenue
  const clientRevenue = clients.map(c => {
    const clientInvoices = allInvoices.filter((i: any) => i.client_id === c.id && i.status === 'paid');
    return {
      id: c.id,
      name: c.name,
      revenue: clientInvoices.reduce((s, i) => s + Number(i.total), 0),
      invoiceCount: clientInvoices.length,
      pending: allInvoices.filter((i: any) => i.client_id === c.id && i.status !== 'paid').length,
    };
  }).filter(c => c.revenue > 0 || c.pending > 0).sort((a, b) => b.revenue - a.revenue);

  const exportCSV = async () => {
    const rows = invoices.map(d => ({
      numero: d.invoice_number,
      date: d.issue_date,
      client: clients.find(c => c.id === d.client_id)?.name || '',
      ht: d.subtotal,
      tva: d.tax_amount,
      ttc: d.total,
      statut: d.status
    }));
    const csv = [
      'numero,date,client,ht,tva,ttc,statut',
      ...rows.map(r => `${r.numero},${r.date},"${r.client}",${r.ht},${r.tva},${r.ttc},${r.statut}`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rapports</h1>
          <p className="text-muted-foreground">Synthèse et analyses pour votre comptabilité.</p>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <Label className="sr-only">Mois</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
          </div>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{summary.issued}</div>
            <p className="text-sm text-muted-foreground">Factures émises</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{summary.paid}</div>
            <p className="text-sm text-muted-foreground">Payées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-600">{summary.outstanding}</div>
            <p className="text-sm text-muted-foreground">En attente</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{summary.overdue}</div>
            <p className="text-sm text-muted-foreground">En retard</p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{summary.totalRevenue.toLocaleString('fr-FR')} TND</div>
            <p className="text-sm text-muted-foreground">Chiffre d'affaires encaissé</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-600">{summary.totalPending.toLocaleString('fr-FR')} TND</div>
            <p className="text-sm text-muted-foreground">En attente de paiement</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{vatCollected.toLocaleString('fr-FR')} TND</div>
            <p className="text-sm text-muted-foreground">TVA collectée</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Par client
          </TabsTrigger>
          <TabsTrigger value="vat" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            TVA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Évolution du CA (6 derniers mois)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getMonthlyData()}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        formatter={(value: number) => [`${value.toLocaleString('fr-FR')} TND`, 'CA']}
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Répartition par statut</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {statusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {statusData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Aucune donnée pour ce mois
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="clients">
          <Card>
            <CardHeader>
              <CardTitle>Chiffre d'affaires par client</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">CA encaissé</TableHead>
                    <TableHead className="text-right">Factures payées</TableHead>
                    <TableHead className="text-right">En attente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientRevenue.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Aucune donnée client
                      </TableCell>
                    </TableRow>
                  ) : (
                    clientRevenue.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right text-green-600 font-medium">
                          {c.revenue.toLocaleString('fr-FR')} TND
                        </TableCell>
                        <TableCell className="text-right">{c.invoiceCount}</TableCell>
                        <TableCell className="text-right text-amber-600">{c.pending}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vat">
          <Card>
            <CardHeader>
              <CardTitle>Rapport TVA - {new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">TVA collectée (ventes)</div>
                  <div className="text-3xl font-bold">{vatCollected.toLocaleString('fr-FR')} TND</div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Base HT</div>
                  <div className="text-3xl font-bold">
                    {invoices.reduce((s, i) => s + Number(i.subtotal), 0).toLocaleString('fr-FR')} TND
                  </div>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facture</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">HT</TableHead>
                    <TableHead className="text-right">Taux TVA</TableHead>
                    <TableHead className="text-right">TVA</TableHead>
                    <TableHead className="text-right">TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono">{inv.invoice_number}</TableCell>
                      <TableCell>{new Date(inv.issue_date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>{clients.find(c => c.id === inv.client_id)?.name || '-'}</TableCell>
                      <TableCell className="text-right">{Number(inv.subtotal).toLocaleString('fr-FR')}</TableCell>
                      <TableCell className="text-right">{inv.tax_rate}%</TableCell>
                      <TableCell className="text-right">{Number(inv.tax_amount).toLocaleString('fr-FR')}</TableCell>
                      <TableCell className="text-right font-medium">{Number(inv.total).toLocaleString('fr-FR')}</TableCell>
                    </TableRow>
                  ))}
                  {invoices.length > 0 && (
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={3}>Total</TableCell>
                      <TableCell className="text-right">{invoices.reduce((s, i) => s + Number(i.subtotal), 0).toLocaleString('fr-FR')}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">{vatCollected.toLocaleString('fr-FR')}</TableCell>
                      <TableCell className="text-right">{invoices.reduce((s, i) => s + Number(i.total), 0).toLocaleString('fr-FR')}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
