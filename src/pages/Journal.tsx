import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Account { id: string; code: string; name: string; type: string }
interface JournalEntry { id: string; entry_date: string; reference: string | null; description: string | null }
interface JournalLine { id: string; entry_id: string; account_id: string; debit: number; credit: number }

export default function Journal() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [lines, setLines] = useState<Record<string, JournalLine[]>>({});
  const [loading, setLoading] = useState(true);

  const [newEntry, setNewEntry] = useState({ date: new Date().toISOString().slice(0,10), reference: '', description: '' });
  const [newLine, setNewLine] = useState({ account_id: '', debit: '', credit: '' });
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    const accRes = await supabase.from('accounts').select('*').order('code');
    const entRes = await supabase.from('journal_entries').select('*').order('entry_date', { ascending: false });
    setAccounts(accRes.data || []);
    setEntries(entRes.data || []);
    // Load lines per entry
    const linesByEntry: Record<string, JournalLine[]> = {};
    for (const e of entRes.data || []) {
      const lr = await supabase.from('journal_lines').select('*').eq('entry_id', e.id);
      linesByEntry[e.id] = lr.data || [];
    }
    setLines(linesByEntry);
    setLoading(false);
  };

  const createEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from('journal_entries').insert({
      user_id: user?.id,
      entry_date: newEntry.date,
      reference: newEntry.reference || null,
      description: newEntry.description || null,
      created_by_user_id: user?.id,
    }).select().single();
    if (!error && data) {
      setCurrentEntryId(data.id);
      await load();
    }
  };

  const addLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEntryId) return;
    const { error } = await supabase.from('journal_lines').insert({
      entry_id: currentEntryId,
      account_id: newLine.account_id,
      debit: Number(newLine.debit || 0),
      credit: Number(newLine.credit || 0),
    });
    if (!error) {
      setNewLine({ account_id: '', debit: '', credit: '' });
      await load();
    }
  };

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Journal Comptable</h1>
        <p className="text-muted-foreground">Saisissez des écritures (débit/crédit) et consultez par période.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Nouvelle écriture</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={createEntry} className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Date</Label>
              <Input type="date" value={newEntry.date} onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })} required />
            </div>
            <div>
              <Label>Référence</Label>
              <Input value={newEntry.reference} onChange={(e) => setNewEntry({ ...newEntry, reference: e.target.value })} />
            </div>
            <div className="md:col-span-3">
              <Label>Description</Label>
              <Input value={newEntry.description} onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })} />
            </div>
            <div className="md:col-span-3"><Button type="submit">Créer</Button></div>
          </form>
        </CardContent>
      </Card>

      {currentEntryId && (
        <Card>
          <CardHeader><CardTitle>Ajouter lignes à l'écriture</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={addLine} className="grid md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Label>Compte (code)</Label>
                <Input value={newLine.account_id} onChange={(e) => setNewLine({ ...newLine, account_id: e.target.value })} placeholder="Sélection via code/ID" />
              </div>
              <div>
                <Label>Débit</Label>
                <Input value={newLine.debit} onChange={(e) => setNewLine({ ...newLine, debit: e.target.value })} />
              </div>
              <div>
                <Label>Crédit</Label>
                <Input value={newLine.credit} onChange={(e) => setNewLine({ ...newLine, credit: e.target.value })} />
              </div>
              <div className="md:col-span-4"><Button type="submit">Ajouter ligne</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Écritures récentes</CardTitle></CardHeader>
        <CardContent>
          {entries.map(e => (
            <div key={e.id} className="mb-6">
              <div className="font-medium">{new Date(e.entry_date).toLocaleDateString('fr-FR')} • {e.reference || '—'}</div>
              <div className="text-sm text-muted-foreground">{e.description || ''}</div>
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>Compte</TableHead>
                    <TableHead>Débit</TableHead>
                    <TableHead>Crédit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(lines[e.id] || []).map(l => (
                    <TableRow key={l.id}>
                      <TableCell>{accounts.find(a => a.id === l.account_id)?.code || ''} {accounts.find(a => a.id === l.account_id)?.name || ''}</TableCell>
                      <TableCell>{Number(l.debit).toLocaleString('fr-FR')}</TableCell>
                      <TableCell>{Number(l.credit).toLocaleString('fr-FR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
