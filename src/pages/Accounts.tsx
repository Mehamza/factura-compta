import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Account { id: string; code: string; name: string; type: string }
interface Line { account_id: string; debit: number; credit: number }

export default function Accounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [period, setPeriod] = useState({ start: '', end: '' });

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    const accRes = await supabase.from('accounts' as any).select('*').order('code');
    setAccounts((accRes.data as Account[]) || []);
    // load lines for period (simple: all lines)
    const lr = await supabase.from('journal_lines' as any).select('account_id,debit,credit');
    setLines((lr.data as Line[]) || []);
  };

  const balances = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number }>();
    for (const l of lines) {
      const cur = map.get(l.account_id) || { debit: 0, credit: 0 };
      cur.debit += Number(l.debit || 0);
      cur.credit += Number(l.credit || 0);
      map.set(l.account_id, cur);
    }
    return map;
  }, [lines]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Balance des comptes</h1>
        <p className="text-muted-foreground">Visualisez les soldes par compte.</p>
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
        <CardHeader><CardTitle>Comptes</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Débit</TableHead>
                <TableHead>Crédit</TableHead>
                <TableHead>Solde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map(a => {
                const b = balances.get(a.id) || { debit: 0, credit: 0 };
                const balance = b.debit - b.credit;
                return (
                  <TableRow key={a.id}>
                    <TableCell>{a.code}</TableCell>
                    <TableCell>{a.name}</TableCell>
                    <TableCell>{a.type}</TableCell>
                    <TableCell>{b.debit.toLocaleString('fr-FR')}</TableCell>
                    <TableCell>{b.credit.toLocaleString('fr-FR')}</TableCell>
                    <TableCell>{balance.toLocaleString('fr-FR')}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
