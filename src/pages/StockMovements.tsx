import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { downloadCSV, mapStockMovementsToCSV, exportServerCSV } from '@/lib/export';
import { canExportData } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Plus, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { LoadingOverlay } from '@/components/ui/loader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Product = Tables<'products'>;
type StockMovement = Tables<'stock_movements'>;

export default function StockMovements() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ product_id: '', movement_type: 'entry', quantity: '', note: '' });
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState('all');
  const canExport = canExportData(role);
  const onExportCSV = async () => {
    if (!canExport) {
      toast({ variant: 'destructive', title: 'Permission refusée', description: 'Vous n’avez pas l’autorisation d’exporter ces données.' });
      return;
    }
    try {
      await exportServerCSV('stock_movements');
      toast({ title: 'Export serveur', description: 'Le téléchargement va démarrer.' });
    } catch (e) {
      const rows = mapStockMovementsToCSV(movements);
      downloadCSV('mouvements_stock', rows);
      toast({ title: 'Export CSV (local)', description: `${rows.length} ligne(s)` });
    }
  };

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    const [prodRes, movRes] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    setProducts(prodRes.data || []);
    setMovements(movRes.data || []);
    setLoading(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.product_id) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Le produit est obligatoire.' });
      return;
    }

    const qty = Number(form.quantity);
    if (isNaN(qty) || qty <= 0) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'La quantité doit être supérieure à 0.' });
      return;
    }

    if (form.movement_type !== 'entry' && form.movement_type !== 'exit') {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Type de mouvement invalide.' });
      return;
    }

    // 1) Load current stock
    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('id, quantity')
      .eq('id', form.product_id)
      .single();

    if (pErr) {
      toast({ variant: 'destructive', title: 'Erreur', description: pErr.message });
      return;
    }

    const oldStock = Number(product?.quantity ?? 0);

    // 2) Compute new stock
    const newStock = form.movement_type === 'entry' ? oldStock + qty : oldStock - qty;

    if (newStock < 0) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Stock insuffisant pour une sortie.' });
      return;
    }

    // 3) Update product stock
    const { error: uErr } = await supabase
      .from('products')
      .update({ quantity: newStock })
      .eq('id', form.product_id);

    if (uErr) {
      toast({ variant: 'destructive', title: 'Erreur', description: uErr.message });
      return;
    }

    // 4) Insert movement
    const { error: mErr } = await supabase.from('stock_movements').insert({
      user_id: user?.id!,
      product_id: form.product_id,
      movement_type: form.movement_type,
      quantity: qty,
      note: form.note || null,
    });

    if (mErr) {
      // Optional: rollback stock here (update back to oldStock) if you want
      toast({ variant: 'destructive', title: 'Erreur', description: mErr.message });
      return;
    }

    toast({ title: 'Succès', description: 'Mouvement enregistré' });
    setDialogOpen(false);
    setForm({ product_id: '', movement_type: 'entry', quantity: '', note: '' });
    load();
  };


  const filtered = useMemo(() => (
    movements.filter(m => (
      (typeFilter === 'all' || m.movement_type === typeFilter) &&
      (productFilter === 'all' || m.product_id === productFilter)
    ))
  ), [movements, typeFilter, productFilter]);

  const productLabel = (id: string) => products.find(p => p.id === id)?.name || '—';

  const canManage = role === 'admin' || role === 'manager';

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
          {canManage && <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Nouveau</Button>}
          {canExport && (
            <Button variant="outline" onClick={onExportCSV}><Download className="h-4 w-4" /> Exporter</Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="entry">Entrée</SelectItem>
                <SelectItem value="exit">Sortie</SelectItem>
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
          {loading ? (
            <div className="py-4">
              <LoadingOverlay label="Chargement des mouvements..." />
              <div className="mt-4">
                <TableSkeleton rows={6} />
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Qté</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>{productLabel(m.product_id)}</TableCell>
                    <TableCell>{m.movement_type === 'entry' ? 'Entrée' : 'Sortie'}</TableCell>
                    <TableCell>{Number(m.quantity).toLocaleString('fr-FR')}</TableCell>
                    <TableCell>{m.note || '—'}</TableCell>
                    <TableCell>{new Date(m.created_at!).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
              <Select value={form.movement_type} onValueChange={(v) => setForm({ ...form, movement_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">Entrée</SelectItem>
                  <SelectItem value="exit">Sortie</SelectItem>
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
