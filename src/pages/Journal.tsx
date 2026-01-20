import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Download, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import JournalEntryDialog from '@/components/journal/JournalEntryDialog';
import type { Tables } from '@/integrations/supabase/types';

type Account = Tables<'accounts'>;
type JournalEntry = Tables<'journal_entries'>;
type JournalLine = Tables<'journal_lines'>;

interface EntryWithLines extends JournalEntry {
  lines: JournalLine[];
}

export default function Journal() {
  const { user, activeCompanyId } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<EntryWithLines[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState({ start: '', end: '' });

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EntryWithLines | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user && activeCompanyId) load(); }, [user, activeCompanyId]);

  const load = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const [accRes, entRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('company_id', activeCompanyId).order('code'),
        supabase
          .from('journal_entries')
          .select('*, journal_lines(*)')
          .eq('company_id', activeCompanyId)
          .order('entry_date', { ascending: false }),
      ]);

      if (accRes.error) throw accRes.error;
      if (entRes.error) throw entRes.error;

      setAccounts(accRes.data || []);
      const entriesData = (entRes.data || []) as (JournalEntry & { journal_lines?: JournalLine[] | null })[];

      if (entriesData.length === 0) {
        setEntries([]);
        return;
      }

      const entriesWithLines: EntryWithLines[] = entriesData.map((e) => {
        const { journal_lines, ...rest } = e;
        return {
          ...(rest as JournalEntry),
          lines: (journal_lines || []) as JournalLine[],
        };
      });

      setEntries(entriesWithLines);
    } catch (error) {
      logger.error('Erreur chargement journal:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = entries.filter(e => {
    if (period.start && e.entry_date < period.start) return false;
    if (period.end && e.entry_date > period.end) return false;
    return true;
  });

  const handleSaveEntry = async (data: { date: string; reference: string; description: string; lines: { account_id: string; debit: number; credit: number }[] }) => {
    if (!user || !activeCompanyId) return;
    setSaving(true);
    try {
      if (editingEntry) {
        // Update entry
        const { error: entryError } = await supabase
          .from('journal_entries')
          .update({
            entry_date: data.date,
            reference: data.reference,
            description: data.description || null
          })
          .eq('company_id', activeCompanyId)
          .eq('id', editingEntry.id);
        if (entryError) throw entryError;

        // Delete old lines and insert new ones
        await supabase.from('journal_lines').delete().eq('company_id', activeCompanyId).eq('entry_id', editingEntry.id);
        const linesToInsert = data.lines.map(l => ({
          entry_id: editingEntry.id,
          company_id: activeCompanyId,
          account_id: l.account_id,
          debit: l.debit,
          credit: l.credit
        }));
        const { error: linesError } = await supabase.from('journal_lines').insert(linesToInsert);
        if (linesError) throw linesError;

        toast.success('Écriture modifiée');
      } else {
        // Create entry
        const { data: newEntry, error: entryError } = await supabase
          .from('journal_entries')
          .insert({
            user_id: user.id,
            company_id: activeCompanyId,
            entry_date: data.date,
            reference: data.reference,
            description: data.description || null,
            created_by_user_id: user.id
          })
          .select()
          .single();
        if (entryError) throw entryError;

        // Insert lines
        const linesToInsert = data.lines.map(l => ({
          entry_id: newEntry.id,
          company_id: activeCompanyId,
          account_id: l.account_id,
          debit: l.debit,
          credit: l.credit
        }));
        const { error: linesError } = await supabase.from('journal_lines').insert(linesToInsert);
        if (linesError) throw linesError;

        toast.success('Écriture créée');
      }
      setDialogOpen(false);
      setEditingEntry(null);
      await load();
    } catch (error) {
      logger.error('Erreur sauvegarde écriture:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entry: EntryWithLines) => {
    try {
      // Lines will be deleted by cascade or we delete manually
      await supabase.from('journal_lines').delete().eq('company_id', activeCompanyId).eq('entry_id', entry.id);
      const { error } = await supabase.from('journal_entries').delete().eq('company_id', activeCompanyId).eq('id', entry.id);
      if (error) throw error;
      toast.success('Écriture supprimée');
      await load();
    } catch (error) {
      logger.error('Erreur suppression écriture:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const exportCSV = () => {
    const rows: string[] = ['date,reference,description,compte,debit,credit'];
    for (const e of filteredEntries) {
      for (const l of e.lines) {
        const acc = accounts.find(a => a.id === l.account_id);
        const isInternalCounterpart = Boolean(
          acc?.code?.startsWith('999-') && (acc?.name || '').toLowerCase().includes('contrepartie')
        );
        const label = isInternalCounterpart ? 'Contrepartie' : `${acc?.code || ''} ${acc?.name || ''}`.trim();
        rows.push(`${e.entry_date},"${e.reference}","${e.description || ''}","${label}",${l.debit},${l.credit}`);
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getAccountLabel = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return '-';
    const isInternalCounterpart = Boolean(
      account.code?.startsWith('999-') && (account.name || '').toLowerCase().includes('contrepartie')
    );
    return isInternalCounterpart ? 'Contrepartie' : `${account.code} ${account.name}`;
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
          <h1 className="text-3xl font-bold">Journal Comptable</h1>
          <p className="text-muted-foreground">Saisissez et consultez vos écritures comptables.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
          <Button onClick={() => { setEditingEntry(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle écriture
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Filtrer par période</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Date début</Label>
            <Input type="date" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} />
          </div>
          <div>
            <Label>Date fin</Label>
            <Input type="date" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Écritures ({filteredEntries.length})</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {filteredEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucune écriture. Créez votre première écriture comptable.</p>
          ) : (
            filteredEntries.map(e => {
              const totalDebit = e.lines.reduce((sum, l) => sum + Number(l.debit), 0);
              const totalCredit = e.lines.reduce((sum, l) => sum + Number(l.credit), 0);
              return (
                <div key={e.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium">{new Date(e.entry_date).toLocaleDateString('fr-FR')}</span>
                      <span className="mx-2">•</span>
                      <span className="text-muted-foreground">{e.reference}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditingEntry(e); setDialogOpen(true); }}
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
                            <AlertDialogTitle>Supprimer l'écriture ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible. L'écriture "{e.reference}" et toutes ses lignes seront supprimées.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteEntry(e)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  {e.description && <p className="text-sm text-muted-foreground mb-2">{e.description}</p>}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Compte</TableHead>
                        <TableHead className="text-right">Débit</TableHead>
                        <TableHead className="text-right">Crédit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {e.lines.map(l => (
                        <TableRow key={l.id}>
                          <TableCell>{getAccountLabel(l.account_id)}</TableCell>
                          <TableCell className="text-right">{Number(l.debit).toLocaleString('fr-FR')}</TableCell>
                          <TableCell className="text-right">{Number(l.credit).toLocaleString('fr-FR')}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-medium bg-muted/50">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{totalDebit.toLocaleString('fr-FR')}</TableCell>
                        <TableCell className="text-right">{totalCredit.toLocaleString('fr-FR')}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <JournalEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accounts={accounts}
        onSave={handleSaveEntry}
        loading={saving}
        editEntry={editingEntry ? {
          id: editingEntry.id,
          entry_date: editingEntry.entry_date,
          reference: editingEntry.reference,
          description: editingEntry.description,
          lines: editingEntry.lines.map(l => ({
            account_id: l.account_id,
            debit: Number(l.debit),
            credit: Number(l.credit)
          }))
        } : null}
      />
    </div>
  );
}
