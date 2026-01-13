import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Download, Edit, Trash2, Banknote, CreditCard, Building } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import PaymentDialog from '@/components/payments/PaymentDialog';
import { InvoicePaymentStatus, isPayableStatus } from '@/lib/documentStatus';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'> & { document_kind?: string | null; payment_status?: string | null; remaining_amount?: number | null };
type Client = Tables<'clients'>;
type Supplier = Tables<'suppliers'>;
type Account = Tables<'accounts'>;
type PaymentType = 'vente' | 'achat';

type PaymentRow = {
  id: string;
  invoice_id: string | null;
  payment_type: string | null;
  account_id: string | null;
  amount: number;
  currency: string | null;
  payment_date: string;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  attachment_document_id: string | null;
  invoice?: { id: string; invoice_number: string; client_id: string | null; supplier_id: string | null } | null;
  client?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
  account?: { id: string; name: string } | null;
  attachment?: { id: string; file_name: string; file_path: string } | null;
};

const methodIcons: Record<string, JSX.Element> = {
  espèces: <Banknote className="h-4 w-4" />,
  carte: <CreditCard className="h-4 w-4" />,
  virement: <Building className="h-4 w-4" />,
};

const methodLabels: Record<string, string> = {
  espèces: 'Espèces',
  virement: 'Virement',
  chèque: 'Chèque',
  carte: 'Carte',
  prélèvement: 'Prélèvement',
  autre: 'Autre',
};

export default function Payments() {
  const { user, activeCompanyId } = useAuth();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState({ start: '', end: '' });
  const [methodFilter, setMethodFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | PaymentType>('all');
  const [accountFilter, setAccountFilter] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRow | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && activeCompanyId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeCompanyId]);

  const load = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const [payRes, invRes, cliRes, supRes, accRes] = await Promise.all([
        supabase
          .from('payments')
          .select(
            `
            id,
            invoice_id,
            payment_type,
            account_id,
            amount,
            currency,
            payment_date,
            payment_method,
            reference,
            notes,
            attachment_document_id,
            invoice:invoice_id(id, invoice_number, client_id, supplier_id),
            client:client_id(id, name),
            supplier:supplier_id(id, name),
            account:account_id(id, name),
            attachment:attachment_document_id(id, file_name, file_path)
          `.trim()
          )
          .eq('company_id', activeCompanyId)
          .order('payment_date', { ascending: false }),
        supabase
          .from('invoices')
          .select('id, invoice_number, total, currency, status, payment_status, remaining_amount, client_id, supplier_id, document_kind')
          .eq('company_id', activeCompanyId)
          .order('invoice_number', { ascending: false }),
        supabase.from('clients').select('id, name').eq('company_id', activeCompanyId).order('name'),
        supabase.from('suppliers').select('id, name').eq('company_id', activeCompanyId).order('name'),
        supabase.from('accounts').select('*').eq('company_id', activeCompanyId).in('account_kind', ['caisse', 'bank']).order('name'),
      ]);

      if (payRes.error) throw payRes.error;
      if (invRes.error) throw invRes.error;
      if (cliRes.error) throw cliRes.error;
      if (supRes.error) throw supRes.error;
      if (accRes.error) throw accRes.error;

      const paymentsData: unknown = payRes.data || [];
      setPayments(paymentsData as PaymentRow[]);
      setInvoices((invRes.data || []) as Invoice[]);
      setClients((cliRes.data || []) as Client[]);
      setSuppliers((supRes.data || []) as Supplier[]);
      setAccounts((accRes.data || []) as Account[]);
    } catch (error) {
      logger.error('Erreur chargement paiements:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (period.start && p.payment_date < period.start) return false;
      if (period.end && p.payment_date > period.end) return false;
      if (methodFilter !== 'all' && p.payment_method !== methodFilter) return false;
      if (typeFilter !== 'all' && (p.payment_type || '') !== typeFilter) return false;
      if (accountFilter !== 'all' && (p.account_id || '') !== accountFilter) return false;
      return true;
    });
  }, [payments, period, methodFilter, typeFilter, accountFilter]);

  const totalAmount = useMemo(() => filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0), [filteredPayments]);

  const pendingInvoicesCount = useMemo(() => {
    return invoices.filter((i) => {
      if (!isPayableStatus(i.status)) return false;
      if (i.document_kind !== 'facture' && i.document_kind !== 'facture_achat') return false;
      return i.payment_status !== InvoicePaymentStatus.PAID;
    }).length;
  }, [invoices]);

  const uploadPaymentAttachment = async (file: File, invoiceId: string | null) => {
    if (!user || !activeCompanyId) return null;

    const invoice = invoiceId ? invoices.find((i) => i.id === invoiceId) : null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
    if (uploadError) throw uploadError;

    const { data: doc, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        company_id: activeCompanyId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        category: 'recu',
        description: 'Pièce jointe paiement',
        invoice_id: invoiceId,
        client_id: invoice?.client_id || null,
        supplier_id: invoice?.supplier_id || null,
      })
      .select('id, file_path')
      .single();

    if (dbError) throw dbError;
    if (!doc?.id) return null;
    return { id: doc.id as string, filePath: (doc.file_path as string) || filePath };
  };

  const cleanupUploadedDocument = async (docId: string, filePath?: string | null) => {
    try {
      if (filePath) {
        await supabase.storage.from('documents').remove([decodeURIComponent(filePath)]);
      }
      await supabase.from('documents').delete().eq('id', docId);
    } catch (error) {
      logger.warn('Cleanup document failed:', error);
    }
  };

  const handleSavePayment = async (data: {
    payment_type: PaymentType;
    invoice_id: string | null;
    amount: number;
    payment_date: string;
    payment_method: string;
    reference: string;
    notes: string;
    account_id: string;
    file?: File | null;
  }) => {
    if (!user || !activeCompanyId) return;
    setSaving(true);

    let attachmentDocumentId: string | null = null;
    let attachmentPath: string | null = null;
    try {
      if (data.file) {
        const uploaded = await uploadPaymentAttachment(data.file, data.invoice_id);
        attachmentDocumentId = uploaded?.id || null;
        attachmentPath = uploaded?.filePath || null;
      }

      if (editingPayment) {
        const { error } = await supabase.rpc('update_payment_operation', {
          p_payment_id: editingPayment.id,
          p_payment_type: data.payment_type,
          p_invoice_id: data.invoice_id,
          p_amount: data.amount,
          p_payment_date: data.payment_date,
          p_payment_method: data.payment_method,
          p_account_id: data.account_id,
          p_reference: data.reference || null,
          p_notes: data.notes || null,
          p_currency: 'TND',
          p_attachment_document_id: attachmentDocumentId ?? editingPayment.attachment_document_id,
        });
        if (error) throw error;
        toast.success('Paiement modifié');
      } else {
        const { error } = await supabase.rpc('create_payment_operation', {
          p_company_id: activeCompanyId,
          p_payment_type: data.payment_type,
          p_invoice_id: data.invoice_id,
          p_amount: data.amount,
          p_payment_date: data.payment_date,
          p_payment_method: data.payment_method,
          p_account_id: data.account_id,
          p_reference: data.reference || null,
          p_notes: data.notes || null,
          p_currency: 'TND',
          p_attachment_document_id: attachmentDocumentId,
        });
        if (error) throw error;
        toast.success('Paiement enregistré');
      }

      setDialogOpen(false);
      setEditingPayment(null);
      await load();
    } catch (error) {
      logger.error('Erreur sauvegarde paiement:', error);
      toast.error('Erreur lors de la sauvegarde');
      if (attachmentDocumentId) {
        await cleanupUploadedDocument(attachmentDocumentId, attachmentPath);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (payment: PaymentRow) => {
    try {
      const { error } = await supabase.rpc('delete_payment_operation', { p_payment_id: payment.id });
      if (error) throw error;
      toast.success('Paiement supprimé');
      await load();
    } catch (error) {
      logger.error('Erreur suppression paiement:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDownload = async (fileName: string, filePath: string) => {
    try {
      const { data, error } = await supabase.storage.from('documents').download(filePath);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Erreur téléchargement:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const exportCSV = () => {
    const rows = filteredPayments.map((p) => ({
      date: p.payment_date,
      type: p.payment_type || '',
      montant: p.amount,
      methode: methodLabels[p.payment_method] || p.payment_method,
      reference: p.reference || '',
      facture: p.invoice?.invoice_number || '',
      tiers: p.payment_type === 'achat' ? (p.supplier?.name || '') : (p.client?.name || ''),
      compte: p.account?.name || '',
      notes: p.notes || '',
    }));

    const csv = [
      'date,type,montant,methode,reference,facture,tiers,compte,notes',
      ...rows.map((r) => `${r.date},${r.type},${r.montant},"${r.methode}","${r.reference}","${r.facture}","${r.tiers}","${r.compte}","${r.notes}"`),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paiements-${new Date().toISOString().slice(0, 10)}.csv`;
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
          <p className="text-muted-foreground">Encaissements (ventes) et décaissements (achats).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
          <Button
            onClick={() => {
              setEditingPayment(null);
              setDialogOpen(true);
            }}
            disabled={accounts.length === 0}
            title={accounts.length === 0 ? "Ajoutez un compte (caisse/banque) avant d'enregistrer un paiement" : ''}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouveau paiement
          </Button>
        </div>
      </div>

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
            <p className="text-sm text-muted-foreground">Total (période filtrée)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{pendingInvoicesCount}</div>
            <p className="text-sm text-muted-foreground">Factures en attente</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-5 gap-4">
          <div>
            <Label>Date début</Label>
            <Input type="date" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} />
          </div>
          <div>
            <Label>Date fin</Label>
            <Input type="date" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} />
          </div>
          <div>
            <Label>Mode</Label>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {Object.entries(methodLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v === 'achat' || v === 'vente' ? v : 'all')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="vente">Vente</SelectItem>
                <SelectItem value="achat">Achat</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Compte</Label>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paiements ({filteredPayments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead>Facture</TableHead>
                <TableHead>Tiers</TableHead>
                <TableHead>Compte</TableHead>
                <TableHead>Pièce</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    Aucun paiement.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.payment_date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>
                      <Badge variant={p.payment_type === 'achat' ? 'outline' : 'secondary'}>{p.payment_type === 'achat' ? 'Achat' : 'Vente'}</Badge>
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      {Number(p.amount).toLocaleString('fr-FR')} {p.currency || 'TND'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        {methodIcons[p.payment_method]}
                        {methodLabels[p.payment_method] || p.payment_method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.reference || '-'}</TableCell>
                    <TableCell>{p.invoice ? <span className="font-mono text-sm">{p.invoice.invoice_number}</span> : '-'}</TableCell>
                    <TableCell>{p.payment_type === 'achat' ? (p.supplier?.name || '-') : (p.client?.name || '-')}</TableCell>
                    <TableCell>{p.account?.name || '-'}</TableCell>
                    <TableCell>
                      {p.attachment ? (
                        <Button variant="ghost" size="icon" onClick={() => void handleDownload(p.attachment!.file_name, p.attachment!.file_path)} title={p.attachment.file_name}>
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingPayment(p);
                            setDialogOpen(true);
                          }}
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
                                Cette action est irréversible. Le paiement de {Number(p.amount).toLocaleString('fr-FR')} {p.currency || 'TND'} sera supprimé.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => void handleDeletePayment(p)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
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
        suppliers={suppliers}
        accounts={accounts}
        onSave={handleSavePayment}
        loading={saving}
        editPayment={
          editingPayment
            ? {
                id: editingPayment.id,
                payment_type: editingPayment.payment_type,
                invoice_id: editingPayment.invoice_id,
                amount: Number(editingPayment.amount),
                payment_date: editingPayment.payment_date,
                payment_method: editingPayment.payment_method,
                reference: editingPayment.reference,
                notes: editingPayment.notes,
                account_id: editingPayment.account_id,
                attachment_document_id: editingPayment.attachment_document_id,
              }
            : null
        }
      />
    </div>
  );
}
