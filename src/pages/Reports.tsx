import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Reports() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0,7));
  const [summary, setSummary] = useState<{ issued: number; paid: number; outstanding: number; overdue: number }>({ issued: 0, paid: 0, outstanding: 0, overdue: 0 });

  useEffect(() => { load(); }, [month]);

  const load = async () => {
    const start = `${month}-01`;
    const end = `${month}-31`;
    const { data: invoices } = await supabase.from('invoices').select('*').gte('issue_date', start).lte('issue_date', end);
    const paid = (invoices || []).filter(i => i.status === 'paid');
    const outstanding = (invoices || []).filter(i => i.status !== 'paid');
    const overdue = (invoices || []).filter(i => i.status === 'overdue');
    setSummary({ issued: invoices?.length || 0, paid: paid.length, outstanding: outstanding.length, overdue: overdue.length });
  };

  const exportCSV = async () => {
    const start = `${month}-01`;
    const end = `${month}-31`;
    const { data } = await supabase.from('invoices').select('*').gte('issue_date', start).lte('issue_date', end);
    const rows = (data || []).map(d => ({ numero: d.invoice_number, date: d.issue_date, client: d.client_id, total: d.total, statut: d.status }));
    const csv = ['numero,date,client,total,statut', ...rows.map(r => `${r.numero},${r.date},${r.client},${r.total},${r.statut}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `rapport-${month}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Rapports mensuels</h1>
        <p className="text-muted-foreground">Synthèse pour l'expert-comptable et export CSV.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Mois</CardTitle></CardHeader>
        <CardContent>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded p-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Résumé</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-4">
          <div><div className="text-sm text-muted-foreground">Factures émises</div><div className="text-2xl font-bold">{summary.issued}</div></div>
          <div><div className="text-sm text-muted-foreground">Payées</div><div className="text-2xl font-bold">{summary.paid}</div></div>
          <div><div className="text-sm text-muted-foreground">En attente</div><div className="text-2xl font-bold">{summary.outstanding}</div></div>
          <div><div className="text-sm text-muted-foreground">En retard</div><div className="text-2xl font-bold">{summary.overdue}</div></div>
        </CardContent>
      </Card>

      <div>
        <Button onClick={exportCSV}>Exporter CSV</Button>
      </div>
    </div>
  );
}
