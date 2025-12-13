import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface Product { id: string; name: string; sku: string }
interface Movement {
  id: string;
  product_id: string;
  movement_type: 'entry' | 'exit' | 'adjust';
  quantity: number;
  note: string | null;
  created_at: string;
}

export default function StockMovements() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ product_id: '', movement_type: 'entry', quantity: '', note: '' });
  const [typeFilter, setTypeFilter] = useState<'all' | 'entry' | 'exit' | 'adjust'>('all');
  const [productFilter, setProductFilter] = useState('all');

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    const [prodRes, movRes] = await Promise.all([
      supabase.from('products').select('id,name,sku').order('name'),
      supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    setProducts(prodRes.data || []);
    setMovements(movRes.data || []);
    setLoading(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_id) { toast({ variant: 'destructive', title: 'Erreur', description: 'Le produit est obligatoire.' }); return; }
    const qty = Number(form.quantity);
    if (isNaN(qty) || qty <= 0) { toast({ variant: 'destructive', title: 'Erreur', description: 'La quantité doit être supérieure à 0.' }); return; }
    const payload = {
      user_id: user?.id,
      product_id: form.product_id,
      movement_type: form.movement_type,
      quantity: qty,
      note: form.note || null,
    };
    const { error } = await supabase.from('stock_movements').insert(payload);
    if (error) toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    else { toast({ title: 'Succès', description: 'Mouvement enregistré' }); setDialogOpen(false); setForm({ product_id: '', movement_type: 'entry', quantity: '', note: '' }); load(); }
  };

  const filtered = useMemo(() => (
    movements.filter(m => (
      (typeFilter === 'all' || m.movement_type === typeFilter) &&
      (productFilter === 'all' || m.product_id === productFilter)
    ))
  ), [movements, typeFilter, productFilter]);

  const productLabel = (id: string) => products.find(p => p.id === id)?.name || '—';

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock / Mouvements</h1>
          <p className="text-muted-foreground">Historique et enregistrement des mouvements de stock.</p>
        </div>
        <div className="flex gap-2">
          {(role === 'admin' || role === 'gerant') && <Button onClick={() => setDialogOpen(true)}>Nouveau mouvement</Button>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="entry">Entrée</SelectItem>
                <SelectItem value="exit">Sortie</SelectItem>
                <SelectItem value="adjust">Ajustement</SelectItem>
              </SelectContent>
            </Select>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Produit" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les produits</SelectItem>
                {products.map(p => (<SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Quantité</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Aucun mouvement</TableCell></TableRow>
              ) : filtered.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{productLabel(m.product_id)}</TableCell>
                  <TableCell>{m.movement_type === 'entry' ? 'Entrée' : m.movement_type === 'exit' ? 'Sortie' : 'Ajustement'}</TableCell>
                  <TableCell>{Number(m.quantity).toLocaleString('fr-FR')}</TableCell>
                  <TableCell>{m.note || '—'}</TableCell>
                  <TableCell>{new Date(m.created_at).toLocaleString('fr-FR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nouveau mouvement</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Produit</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => (<SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.movement_type} onValueChange={(v) => setForm({ ...form, movement_type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">Entrée</SelectItem>
                  <SelectItem value="exit">Sortie</SelectItem>
                  <SelectItem value="adjust">Ajustement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantité</Label>
              <Input type="number" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Note</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
