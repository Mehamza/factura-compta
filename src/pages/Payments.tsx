import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Payment {
  id: string;
  invoice_id: string | null;
  client_id: string | null;
  method_id: string | null;
  amount: number;
  currency: string;
  paid_at: string;
  reference: string | null;
  notes: string | null;
}

interface PaymentMethod { id: string; name: string; type: string }

export default function Payments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    invoice_id: '',
    client_id: '',
    method_id: '',
    amount: '',
    paid_at: new Date().toISOString().slice(0, 10),
    reference: '',
    notes: '',
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const [pmRes, payRes] = await Promise.all([
      supabase.from('payment_methods').select('*').order('name'),
      supabase.from('payments').select('*').order('paid_at', { ascending: false }),
    ]);
    setMethods(pmRes.data || []);
    setPayments(payRes.data || []);
    setLoading(false);
  };

  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('payments').insert({
      user_id: user?.id,
      invoice_id: form.invoice_id || null,
      client_id: form.client_id || null,
      method_id: form.method_id || null,
      amount: Number(form.amount),
      paid_at: form.paid_at,
      reference: form.reference || null,
      notes: form.notes || null,
      created_by_user_id: user?.id,
    });
    if (!error) {
      setForm({ invoice_id: '', client_id: '', method_id: '', amount: '', paid_at: new Date().toISOString().slice(0, 10), reference: '', notes: '' });
      fetchData();
    }
  };

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Paiements</h1>
        <p className="text-muted-foreground">Enregistrez et suivez les paiements liés aux factures.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ajouter un paiement</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addPayment} className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Montant</Label>
              <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" required />
            </div>
            <div>
              <Label>Date de paiement</Label>
              <Input type="date" value={form.paid_at} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} required />
            </div>
            <div>
              <Label>Méthode</Label>
              <Select value={form.method_id} onValueChange={(v) => setForm({ ...form, method_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {methods.map(m => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Label>Référence</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Référence (optionnel)" />
            </div>
            <div className="md:col-span-3">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optionnel)" />
            </div>
            <div className="md:col-span-3">
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des paiements</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead>Référence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.paid_at).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>{Number(p.amount).toLocaleString('fr-FR')} {p.currency}</TableCell>
                  <TableCell>{methods.find(m => m.id === p.method_id)?.name || '-'}</TableCell>
                  <TableCell>{p.reference || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
