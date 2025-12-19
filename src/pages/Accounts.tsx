import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Download, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import AccountDialog from '@/components/accounts/AccountDialog';
import type { Tables } from '@/integrations/supabase/types';

type Account = Tables<'accounts'>;

interface Line { account_id: string; debit: number; credit: number; entry_date: string }

export default function Accounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState({ start: '', end: '' });
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    const accRes = await supabase.from('accounts').select('*').order('code');
    setAccounts(accRes.data || []);
    
    // Get journal lines with entry date for period filtering
    const { data: entries } = await supabase
      .from('journal_entries')
      .select('id, entry_date');
    
    const entryMap = new Map(entries?.map(e => [e.id, e.entry_date]) || []);
    
    const lr = await supabase.from('journal_lines').select('account_id, debit, credit, entry_id');
    const linesWithDate = (lr.data || []).map(l => ({
      account_id: l.account_id,
      debit: Number(l.debit),
      credit: Number(l.credit),
      entry_date: entryMap.get(l.entry_id) || ''
    }));
    setLines(linesWithDate);
    setLoading(false);
  };

  const filteredLines = useMemo(() => {
    if (!period.start && !period.end) return lines;
    return lines.filter(l => {
      if (period.start && l.entry_date < period.start) return false;
      if (period.end && l.entry_date > period.end) return false;
      return true;
    });
  }, [lines, period]);

  const balances = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number }>();
    for (const l of filteredLines) {
      const cur = map.get(l.account_id) || { debit: 0, credit: 0 };
      cur.debit += l.debit;
      cur.credit += l.credit;
      map.set(l.account_id, cur);
    }
    return map;
  }, [filteredLines]);

  const handleSaveAccount = async (data: { code: string; name: string; type: string }) => {
    if (!user) return;
    setSaving(true);
    try {
      if (editingAccount) {
        const { error } = await supabase
          .from('accounts')
          .update(data)
          .eq('id', editingAccount.id);
        if (error) throw error;
        toast.success('Compte modifié');
      } else {
        const { error } = await supabase
          .from('accounts')
          .insert({ ...data, user_id: user.id });
        if (error) throw error;
        toast.success('Compte créé');
      }
      setDialogOpen(false);
      setEditingAccount(null);
      await load();
    } catch (error) {
      logger.error('Erreur sauvegarde compte:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (account: Account) => {
    try {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', account.id);
      if (error) throw error;
      toast.success('Compte supprimé');
      await load();
    } catch (error) {
      logger.error('Erreur suppression compte:', error);
      toast.error('Impossible de supprimer ce compte (utilisé dans des écritures)');
    }
  };

  const exportCSV = () => {
    const rows = accounts.map(a => {
      const b = balances.get(a.id) || { debit: 0, credit: 0 };
      return {
        code: a.code,
        nom: a.name,
        type: a.type,
        debit: b.debit,
        credit: b.credit,
        solde: b.debit - b.credit
      };
    });
    const csv = [
      'code,nom,type,debit,credit,solde',
      ...rows.map(r => `${r.code},"${r.nom}",${r.type},${r.debit},${r.credit},${r.solde}`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balance-comptes-${new Date().toISOString().slice(0,10)}.csv`;
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
          <h1 className="text-3xl font-bold">Balance des comptes</h1>
          <p className="text-muted-foreground">Gérez vos comptes et visualisez les soldes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
          <Button onClick={() => { setEditingAccount(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau compte
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Période</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Début</Label>
            <Input type="date" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} />
          </div>
          <div>
            <Label>Fin</Label>
            <Input type="date" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Comptes ({accounts.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Débit</TableHead>
                <TableHead className="text-right">Crédit</TableHead>
                <TableHead className="text-right">Solde</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Aucun compte. Créez votre premier compte comptable.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map(a => {
                  const b = balances.get(a.id) || { debit: 0, credit: 0 };
                  const balance = b.debit - b.credit;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono">{a.code}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell className="capitalize">{a.type}</TableCell>
                      <TableCell className="text-right">{b.debit.toLocaleString('fr-FR')}</TableCell>
                      <TableCell className="text-right">{b.credit.toLocaleString('fr-FR')}</TableCell>
                      <TableCell className={`text-right font-medium ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {balance.toLocaleString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setEditingAccount(a); setDialogOpen(true); }}
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
                                  Cette action est irréversible. Le compte "{a.code} - {a.name}" sera supprimé.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteAccount(a)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

      <AccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editingAccount}
        onSave={handleSaveAccount}
        loading={saving}
      />
    </div>
  );
}
