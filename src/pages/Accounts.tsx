import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
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
import { Download, Edit, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import CompteDialog, { type CompteEditModel, type CompteFormData } from '@/components/accounts/CompteDialog';
import ExpenseDialog, { type ExpenseFormData } from '@/components/accounts/ExpenseDialog';
import AccountLoadDialog, { type AccountLoadFormData } from '@/components/accounts/AccountLoadDialog';

type CompteRow = {
  id: string;
  code: string;
  name: string;
  account_kind: string | null;
  currency: string | null;
  bank: string | null;
  agency: string | null;
  iban: string | null;
};

type ExpenseRow = {
  id: string;
  amount: number;
  expense_date: string;
  category: string | null;
  description: string | null;
  payment_method: string | null;
  reference: string | null;
  account_id: string;
  attachment_document_id: string | null;
  account?: { name: string } | null;
  attachment?: { id: string; file_name: string; file_path: string } | null;
};

type Line = { account_id: string; debit: number; credit: number; entry_id: string };

export default function Accounts() {
  const { user, activeCompanyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [comptes, setComptes] = useState<CompteRow[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  const [compteDialogOpen, setCompteDialogOpen] = useState(false);
  const [editingCompte, setEditingCompte] = useState<CompteEditModel | null>(null);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [accountLoadDialogOpen, setAccountLoadDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && activeCompanyId) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeCompanyId]);

  const load = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const comptesRes = await supabase
        .from('accounts')
        .select('id, code, name, account_kind, currency, bank, agency, iban')
        .eq('company_id', activeCompanyId)
        .in('account_kind', ['caisse', 'bank'])
        .order('name');

      const comptesData = (comptesRes.data || []) as CompteRow[];
      setComptes(comptesData);

      const compteIds = comptesData.map((c) => c.id);
      if (compteIds.length === 0) {
        setLines([]);
      } else {
        // NOTE: PostgREST has been returning 42703 with UUID lists (`in.(...)`) and also with `or=(...)`.
        // Cash/bank accounts are few, so the simplest safe approach is one query per account.
        const allLines: Line[] = [];
        const concurrency = 8;

        for (let i = 0; i < compteIds.length; i += concurrency) {
          const batch = compteIds.slice(i, i + concurrency);
          const results = await Promise.all(
            batch.map((accountId) =>
              supabase
                .from('journal_lines')
                .select('account_id, debit, credit, entry_id')
                .eq('company_id', activeCompanyId)
                .eq('account_id', accountId)
            )
          );

          for (const r of results) {
            if (r.error) throw r.error;
            for (const l of r.data || []) {
              allLines.push({
                account_id: l.account_id,
                debit: Number(l.debit),
                credit: Number(l.credit),
                entry_id: l.entry_id,
              });
            }
          }
        }

        setLines(allLines);
      }

      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select(
          `
          id,
          amount,
          expense_date,
          category,
          description,
          payment_method,
          reference,
          account_id,
          attachment_document_id,
          account:account_id(name),
          attachment:attachment_document_id(id, file_name, file_path)
        `.trim()
        )
        .eq('company_id', activeCompanyId)
        .order('expense_date', { ascending: false })
        .limit(50);

      if (expensesError) throw expensesError;
      const expensesRows: unknown = expensesData || [];
      setExpenses(expensesRows as ExpenseRow[]);
    } catch (error) {
      logger.error('Erreur chargement comptes/dépenses:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const balances = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number }>();
    for (const l of lines) {
      const cur = map.get(l.account_id) || { debit: 0, credit: 0 };
      cur.debit += l.debit;
      cur.credit += l.credit;
      map.set(l.account_id, cur);
    }
    return map;
  }, [lines]);

  const formatAmount = (value: number) => value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const generateCompteCode = (kind: string) => {
    const suffix = String(Date.now()).slice(-6);
    const prefix = kind === 'caisse' ? 'CA' : 'BK';
    return `${prefix}-${suffix}`;
  };

  const handleSaveCompte = async (data: CompteFormData) => {
    if (!user || !activeCompanyId) return;
    setSaving(true);
    try {
      if (editingCompte) {
        const { error } = await supabase
          .from('accounts')
          .update({
            name: data.name,
            account_kind: data.kind,
            currency: data.currency,
            bank: data.bank || null,
            agency: data.agency || null,
            iban: data.iban || null,
          })
          .eq('id', editingCompte.id);
        if (error) throw error;
        toast.success('Compte modifié');
      } else {
        const code = generateCompteCode(data.kind);
        const { error } = await supabase.from('accounts').insert({
          user_id: user.id,
          company_id: activeCompanyId,
          code,
          name: data.name,
          type: 'asset',
          account_kind: data.kind,
          currency: data.currency,
          bank: data.bank || null,
          agency: data.agency || null,
          iban: data.iban || null,
        });
        if (error) throw error;
        toast.success('Compte créé');
      }

      setCompteDialogOpen(false);
      setEditingCompte(null);
      await load();
    } catch (error) {
      logger.error('Erreur sauvegarde compte:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCompte = async (compte: CompteRow) => {
    try {
      const { error } = await supabase.from('accounts').delete().eq('company_id', activeCompanyId).eq('id', compte.id);
      if (error) throw error;
      toast.success('Compte supprimé');
      await load();
    } catch (error) {
      logger.error('Erreur suppression compte:', error);
      toast.error('Impossible de supprimer ce compte (utilisé dans des écritures)');
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
      logger.error('Erreur téléchargement pièce jointe:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const uploadExpenseAttachment = async (file: File) => {
    if (!user || !activeCompanyId) return null;
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
        description: 'Pièce jointe dépense',
      })
      .select('id, file_path')
      .single();

    if (dbError) throw dbError;
    if (!doc?.id) return null;
    return { id: doc.id as string, filePath: (doc.file_path as string) || filePath };
  };

  const uploadAccountLoadAttachment = async (file: File) => {
    if (!user || !activeCompanyId) return null;
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
        description: 'Pièce jointe chargement compte',
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

  const handleSaveExpense = async (data: ExpenseFormData) => {
    if (!activeCompanyId) return;
    setSaving(true);
    let attachmentDocumentId: string | null = null;
    let attachmentPath: string | null = null;
    try {
      if (data.file) {
        const uploaded = await uploadExpenseAttachment(data.file);
        attachmentDocumentId = uploaded?.id || null;
        attachmentPath = uploaded?.filePath || null;
      }

      const { error } = await supabase.rpc('create_expense_operation', {
        p_company_id: activeCompanyId,
        p_account_id: data.account_id,
        p_amount: data.amount,
        p_expense_date: data.expense_date,
        p_category: data.category,
        p_description: data.description,
        p_payment_method: data.payment_method,
        p_reference: data.reference || null,
        p_currency: 'TND',
        p_attachment_document_id: attachmentDocumentId,
      });
      if (error) throw error;

      toast.success('Dépense enregistrée');
      setExpenseDialogOpen(false);
      await load();
    } catch (error) {
      logger.error('Erreur création dépense:', error);
      toast.error('Erreur lors de la création de la dépense');
      if (attachmentDocumentId) {
        await cleanupUploadedDocument(attachmentDocumentId, attachmentPath);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAccountLoad = async (data: AccountLoadFormData) => {
    if (!activeCompanyId) return;
    setSaving(true);
    let attachmentDocumentId: string | null = null;
    let attachmentPath: string | null = null;
    try {
      if (data.file) {
        const uploaded = await uploadAccountLoadAttachment(data.file);
        attachmentDocumentId = uploaded?.id || null;
        attachmentPath = uploaded?.filePath || null;
      }

      const selectedAccount = comptes.find((c) => c.id === data.account_id);
      const currency = selectedAccount?.currency || 'TND';

      const { error } = await supabase.rpc('create_account_load_operation', {
        p_company_id: activeCompanyId,
        p_account_id: data.account_id,
        p_amount: data.amount,
        p_load_date: data.load_date,
        p_origin: data.origin,
        p_notes: data.notes || null,
        p_currency: currency,
        p_attachment_document_id: attachmentDocumentId,
      });
      if (error) throw error;

      toast.success('Compte chargé');
      setAccountLoadDialogOpen(false);
      await load();
    } catch (error) {
      logger.error('Erreur chargement compte:', error);
      toast.error('Erreur lors du chargement du compte');
      if (attachmentDocumentId) {
        await cleanupUploadedDocument(attachmentDocumentId, attachmentPath);
      }
    } finally {
      setSaving(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Comptes</h1>
          <p className="text-muted-foreground">Caisse et comptes bancaires, soldes et dépenses.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setEditingCompte(null);
              setCompteDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouveau compte
          </Button>
          <Button
            variant="outline"
            onClick={() => setAccountLoadDialogOpen(true)}
            disabled={comptes.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Charger compte
          </Button>
          <Button
            onClick={() => setExpenseDialogOpen(true)}
            disabled={comptes.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle dépense
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comptes ({comptes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Devise</TableHead>
                <TableHead>Détails</TableHead>
                <TableHead className="text-right">Solde</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comptes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Aucun compte. Créez une caisse ou un compte bancaire.
                  </TableCell>
                </TableRow>
              ) : (
                comptes.map((c) => {
                  const b = balances.get(c.id) || { debit: 0, credit: 0 };
                  const balance = b.debit - b.credit;
                  const details = c.account_kind === 'bank'
                    ? [c.bank, c.agency, c.iban].filter(Boolean).join(' • ')
                    : '';

                  return (
                    <TableRow key={c.id}>
                      <TableCell>{c.account_kind === 'bank' ? 'Banque' : 'Caisse'}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.currency || 'TND'}</TableCell>
                      <TableCell className="text-muted-foreground">{details}</TableCell>
                      <TableCell className={`text-right font-medium ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatAmount(balance)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingCompte({
                                id: c.id,
                                name: c.name,
                                account_kind: c.account_kind,
                                currency: c.currency,
                                bank: c.bank,
                                agency: c.agency,
                                iban: c.iban,
                              });
                              setCompteDialogOpen(true);
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
                                <AlertDialogTitle>Supprimer le compte ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cette action est irréversible. Le compte "{c.name}" sera supprimé.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => void handleDeleteCompte(c)}
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
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dépenses récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Compte</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="w-24">Pièce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Aucune dépense.
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">{e.expense_date}</TableCell>
                    <TableCell>{e.account?.name || '-'}</TableCell>
                    <TableCell>{e.category || '-'}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{e.description || '-'}</TableCell>
                    <TableCell>{e.payment_method || '-'}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{e.reference || '-'}</TableCell>
                    <TableCell className="text-right">{formatAmount(Number(e.amount))}</TableCell>
                    <TableCell>
                      {e.attachment ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDownload(e.attachment!.file_name, e.attachment!.file_path)}
                          title={e.attachment.file_name}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CompteDialog
        open={compteDialogOpen}
        onOpenChange={setCompteDialogOpen}
        compte={editingCompte}
        onSave={handleSaveCompte}
        loading={saving}
      />

      <AccountLoadDialog
        open={accountLoadDialogOpen}
        onOpenChange={setAccountLoadDialogOpen}
        comptes={comptes}
        onSave={handleSaveAccountLoad}
        loading={saving}
      />

      <ExpenseDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        comptes={comptes}
        onSave={handleSaveExpense}
        loading={saving}
      />
    </div>
  );
}
