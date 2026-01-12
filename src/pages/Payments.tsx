import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Download, Edit, Trash2, Banknote, CreditCard, Building } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import PaymentDialog from '@/components/payments/PaymentDialog';
import { InvoiceStatus } from '@/lib/documentStatus';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'>;
type Client = Tables<'clients'>;
type Account = Tables<'accounts'>;

interface Payment {
  id: string;
  user_id: string;
  invoice_id: string | null;
  account_id?: string | null;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const methodIcons: Record<string, React.ReactNode> = {
  'espèces': <Banknote className="h-4 w-4" />,
  'carte': <CreditCard className="h-4 w-4" />,
  'virement': <Building className="h-4 w-4" />,
};

const methodLabels: Record<string, string> = {
  'espèces': 'Espèces',
  'virement': 'Virement',
  'chèque': 'Chèque',
  'carte': 'Carte',
  'prélèvement': 'Prélèvement',
  'autre': 'Autre',
};

export default function Payments() {
  const { user, activeCompanyId } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState({ start: '', end: '' });
  const [methodFilter, setMethodFilter] = useState('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    const [payRes, invRes, cliRes, accRes] = await Promise.all([
      supabase.from('payments').select('*').order('payment_date', { ascending: false }),
      supabase.from('invoices').select('*'),
      supabase.from('clients').select('*'),
      supabase.from('accounts').select('*').order('code'),
    ]);
    setPayments((payRes.data as Payment[]) || []);
    setInvoices(invRes.data || []);
    setClients(cliRes.data || []);
    setAccounts(accRes.data || []);
    setLoading(false);
  };

  const filteredPayments = payments.filter(p => {
    if (period.start && p.payment_date < period.start) return false;
    if (period.end && p.payment_date > period.end) return false;
    if (methodFilter !== 'all' && p.payment_method !== methodFilter) return false;
    return true;
  });

  const totalAmount = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const getClientName = (clientId: string | null) => {
    if (!clientId) return '-';
    return clients.find(c => c.id === clientId)?.name || '-';
  };

  const getInvoiceInfo = (invoiceId: string | null) => {
    if (!invoiceId) return null;
    return invoices.find(i => i.id === invoiceId);
  };

  const handleSavePayment = async (data: {
    invoice_id: string | null;
    amount: number;
    payment_date: string;
    payment_method: string;
    reference: string;
    notes: string;
    account_id: string;
  }) => {
    if (!user) return;
    setSaving(true);
    try {
      if (editingPayment) {
        const { error } = await supabase
          .from('payments')
          .update({
            invoice_id: data.invoice_id || null,
            account_id: data.account_id || null,
            amount: data.amount,
            payment_date: data.payment_date,
            payment_method: data.payment_method,
            reference: data.reference || null,
            notes: data.notes || null
          })
          .eq('id', editingPayment.id);
        if (error) throw error;
        toast.success('Paiement modifié');
      } else {
        // Prefer server-side RPC to ensure atomicity: insert payment + update account balance
        const rpcParams = {
          user_id: user.id,
          invoice_id: data.invoice_id || null,
          amount: data.amount,
          payment_date: data.payment_date,
          payment_method: data.payment_method,
          reference: data.reference || null,
          notes: data.notes || null,
          account_id: data.account_id
        };
        const { data: rpcData, error: rpcError } = await supabase.rpc('create_payment_with_account', rpcParams);
        if (rpcError) {
          // Fallback: direct insert + client-side account update
          logger.warn('RPC create_payment_with_account failed, falling back to direct insert:', rpcError);
          const { error } = await supabase
            .from('payments')
            .insert({
              user_id: user.id,
              company_id: activeCompanyId,
              invoice_id: data.invoice_id || null,
              account_id: data.account_id || null,
              amount: data.amount,
              payment_date: data.payment_date,
              payment_method: data.payment_method,
              reference: data.reference || null,
              notes: data.notes || null
            });
          if (error) throw error;

          // Update invoice status if fully paid (fallback path)
          if (data.invoice_id) {
            const invoice = invoices.find(i => i.id === data.invoice_id);
            if (invoice) {
              const { data: invPayments } = await supabase
                .from('payments')
                .select('amount')
                .eq('invoice_id', data.invoice_id);
              const totalPaid = (invPayments || []).reduce((s, p) => s + Number(p.amount), 0) + data.amount;
              if (totalPaid >= Number(invoice.total)) {
                await supabase.from('invoices').update({ status: 'paid' }).eq('id', data.invoice_id);
              }
            }
          }

          toast.success('Paiement enregistré');
        } else {
          toast.success('Paiement enregistré');
        }
      }
      setDialogOpen(false);
      setEditingPayment(null);
      await load();
    } catch (error) {
      logger.error('Erreur sauvegarde paiement:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (payment: Payment) => {
    try {
      const { error } = await supabase.from('payments').delete().eq('id', payment.id);
      if (error) throw error;
      toast.success('Paiement supprimé');
      await load();
    } catch (error) {
      logger.error('Erreur suppression paiement:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const exportCSV = () => {
    const rows = filteredPayments.map(p => {
      const inv = getInvoiceInfo(p.invoice_id);
      return {
        date: p.payment_date,
        montant: p.amount,
        methode: methodLabels[p.payment_method] || p.payment_method,
        reference: p.reference || '',
        facture: inv?.invoice_number || '',
        client: inv ? getClientName(inv.client_id) : '',
        notes: p.notes || ''
      };
    });
    const csv = [
      'date,montant,methode,reference,facture,client,notes',
      ...rows.map(r => `${r.date},${r.montant},"${r.methode}","${r.reference}","${r.facture}","${r.client}","${r.notes}"`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paiements-${new Date().toISOString().slice(0,10)}.csv`;
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
          <h1 className="text-3xl font-bold">Paiements</h1>
          <p className="text-muted-foreground">Gérez et suivez tous vos paiements reçus.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
          <Button
            onClick={() => { setEditingPayment(null); setDialogOpen(true); }}
            disabled={accounts.length === 0}
            title={accounts.length === 0 ? "Ajoutez un compte bancaire avant d'enregistrer un paiement" : ''}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouveau paiement
          </Button>
        </div>
      </div>

      {/* Stats Card */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{filteredPayments.length}</div>
            <p className="text-sm text-muted-foreground">Paiements</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{totalAmount.toLocaleString('fr-FR')} TND</div>
            <p className="text-sm text-muted-foreground">Total encaissé</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{invoices.filter((i: any) => i.payment_status !== 'paid').length}</div>
            <p className="text-sm text-muted-foreground">Factures en attente</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader><CardTitle>Filtres</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div>
            <Label>Date début</Label>
            <Input type="date" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} />
          </div>
          <div>
            <Label>Date fin</Label>
            <Input type="date" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} />
          </div>
          <div>
            <Label>Mode de paiement</Label>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {Object.entries(methodLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader><CardTitle>Paiements ({filteredPayments.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead>Facture</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Aucun paiement. Enregistrez votre premier paiement.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map(p => {
                  const inv = getInvoiceInfo(p.invoice_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.payment_date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell className="font-medium text-green-600">
                        {Number(p.amount).toLocaleString('fr-FR')} TND
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          {methodIcons[p.payment_method]}
                          {methodLabels[p.payment_method] || p.payment_method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.reference || '-'}</TableCell>
                      <TableCell>
                        {inv ? (
                          <span className="font-mono text-sm">{inv.invoice_number}</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{inv ? getClientName(inv.client_id) : '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setEditingPayment(p); setDialogOpen(true); }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer le paiement ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cette action est irréversible. Le paiement de {Number(p.amount).toLocaleString('fr-FR')} TND sera supprimé.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeletePayment(p)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        invoices={invoices}
        clients={clients}
        accounts={accounts}
        onSave={handleSavePayment}
        loading={saving}
        editPayment={editingPayment}
      />
    </div>
  );
}
