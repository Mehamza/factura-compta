import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'>;
type Client = Tables<'clients'>;

export default function Payments() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const [invRes, cliRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('status', 'paid').order('updated_at', { ascending: false }),
      supabase.from('clients').select('*'),
    ]);
    setInvoices(invRes.data || []);
    setClients(cliRes.data || []);
    setLoading(false);
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId) return '-';
    return clients.find(c => c.id === clientId)?.name || '-';
  };

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Paiements</h1>
        <p className="text-muted-foreground">Historique des factures payées.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Factures payées</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>N° Facture</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Devise</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Aucune facture payée
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell>{new Date(inv.updated_at).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{getClientName(inv.client_id)}</TableCell>
                    <TableCell>{Number(inv.total).toLocaleString('fr-FR')}</TableCell>
                    <TableCell>{inv.currency || 'TND'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
