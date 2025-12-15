import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { canManageProducts, canDeleteProducts, NO_PERMISSION_MSG } from '@/lib/permissions';
import type { Tables } from '@/integrations/supabase/types';

type Product = Tables<'products'>;

export default function StockProducts() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: '',
    description: '',
    purchase_price: '',
    sale_price: '',
    initial_qty: '',
    min_stock: '',
    unit: '',
    vat_rate: '',
    supplier: '',
    currency: 'TND',
  });

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    const prodRes = await supabase.from('products').select('*').order('name');
    setProducts(prodRes.data || []);
    setLoading(false);
    const low = (prodRes.data || []).filter(p => Number(p.quantity) <= Number(p.min_stock));
    if (low.length > 0) {
      toast({ title: 'Stock faible', description: `${low.length} produit(s) en dessous du stock minimum` });
    }
  };

  const openNew = () => {
    if (!canManageProducts(role)) { toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG }); return; }
    setEditing(null);
    setForm({
      name: '', sku: '', category: '', description: '', purchase_price: '', sale_price: '', initial_qty: '', min_stock: '', unit: '', vat_rate: '', supplier: '', currency: 'TND',
    });
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    if (!canManageProducts(role)) { toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG }); return; }
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku || '',
      category: (p as any).category || '',
      description: (p as any).description || '',
      purchase_price: String((p as any).purchase_price ?? ''),
      sale_price: String((p as any).sale_price ?? ''),
      initial_qty: String((p as any).initial_qty ?? ''),
      min_stock: String(p.min_stock ?? ''),
      unit: (p as any).unit || '',
      vat_rate: String((p as any).vat_rate ?? ''),
      supplier: (p as any).supplier || '',
      currency: (p as any).currency || 'TND',
    });
    setDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageProducts(role)) { toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG }); return; }
    const requiredOk = form.name.trim() && form.sku.trim() && form.category.trim() && form.purchase_price.trim() && form.sale_price.trim() && form.initial_qty.trim() && form.min_stock.trim();
    if (!requiredOk) { toast({ variant: 'destructive', title: 'Champs requis', description: 'Veuillez remplir tous les champs obligatoires.' }); return; }
    const initialQty = Number(form.initial_qty || 0);
    const min = Number(form.min_stock || 0);
    const purchase = Number(form.purchase_price || 0);
    const sale = Number(form.sale_price || 0);
    const vat = Number(form.vat_rate || 0);
    if (initialQty < 0 || min < 0 || purchase < 0 || sale < 0 || vat < 0) {
      toast({ variant: 'destructive', title: 'Valeurs invalides', description: 'Les valeurs numériques doivent être positives.' });
      return;
    }
    // Prevent duplicate SKU among existing products
    const duplicateSku = products.some(p => (p.sku || '').toLowerCase() === form.sku.trim().toLowerCase() && (!editing || p.id !== editing.id));
    if (duplicateSku) { toast({ variant: 'destructive', title: 'Erreur', description: 'SKU déjà utilisé pour un autre produit.' }); return; }

    const payload = {
      user_id: user?.id!,
      name: form.name.trim(),
      sku: form.sku.trim(),
      category: form.category.trim(),
      description: form.description.trim() || null,
      purchase_price: purchase,
      sale_price: sale,
      initial_qty: initialQty,
      min_stock: min,
      unit: form.unit.trim() || null,
      vat_rate: vat,
      supplier: form.supplier.trim() || null,
      currency: form.currency,
    } as any;
    if (editing) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
      if (error) toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      else { toast({ title: 'Succès', description: 'Produit modifié' }); setDialogOpen(false); await load(); }
    } else {
      const { error } = await supabase.from('products').insert(payload);
      if (error) toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      else { toast({ title: 'Succès', description: 'Produit ajouté' }); setDialogOpen(false); await load(); }
    }
  };

  const remove = async (id: string) => {
    if (!canDeleteProducts(role)) { toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG }); return; }
    if (!confirm('Supprimer ce produit ?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    else { toast({ title: 'Succès', description: 'Produit supprimé' }); load(); }
  };

  const filtered = useMemo(() => (
    products.filter(p => (
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
    ))
  ), [products, search]);

  const canManage = canManageProducts(role);
  const canDelete = canDeleteProducts(role);

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock / Produits</h1>
          <p className="text-muted-foreground">Gérez vos produits et quantités en stock.</p>
        </div>
        <div className="flex gap-2">
          {canManage && <Button onClick={openNew}>Ajouter produit</Button>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Input placeholder="Rechercher par nom ou SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Quantité</TableHead>
                <TableHead>Stock minimum</TableHead>
                <TableHead>Prix unitaire</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Aucun produit</TableCell></TableRow>
              ) : filtered.map(p => {
                const low = Number(p.quantity) <= Number(p.min_stock);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.sku || '-'}</TableCell>
                    <TableCell>{Number(p.quantity).toLocaleString('fr-FR')}</TableCell>
                    <TableCell>{Number(p.min_stock).toLocaleString('fr-FR')}</TableCell>
                    <TableCell>{Number(p.unit_price).toLocaleString('fr-FR')} DT</TableCell>
                    <TableCell>
                      {low ? <Badge variant="destructive">Stock faible</Badge> : <Badge variant="outline">Stock normal</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canManage ? (
                          <Button variant="outline" size="sm" onClick={() => openEdit(p)}>Modifier</Button>
                        ) : (
                          <Button variant="outline" size="sm" disabled title="Action non autorisée">Modifier</Button>
                        )}
                        {canDelete ? (
                          <Button variant="destructive" size="sm" onClick={() => remove(p.id)}>Supprimer</Button>
                        ) : (
                          <Button variant="destructive" size="sm" disabled title="Action non autorisée">Supprimer</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le produit' : 'Ajouter un produit'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-6">
            <div>
              <h4 className="font-medium">Informations produit</h4>
              <div className="grid md:grid-cols-2 gap-4 mt-2">
                <div>
                  <Label>Nom du produit</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>Code produit / SKU</Label>
                  <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                </div>
                <div>
                  <Label>Catégorie</Label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium">Prix & Stock</h4>
              <div className="grid md:grid-cols-2 gap-4 mt-2">
                <div>
                  <Label>Prix d’achat</Label>
                  <Input type="number" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
                </div>
                <div>
                  <Label>Prix de vente</Label>
                  <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
                </div>
                <div>
                  <Label>Quantité initiale</Label>
                  <Input type="number" step="0.01" value={form.initial_qty} onChange={(e) => setForm({ ...form, initial_qty: e.target.value })} />
                </div>
                <div>
                  <Label>Stock minimum</Label>
                  <Input type="number" step="0.01" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
                </div>
                <div>
                  <Label>Unité</Label>
                  <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pièce, kg, lot…" />
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium">Fournisseur, TVA, Devise</h4>
              <div className="grid md:grid-cols-3 gap-4 mt-2">
                <div>
                  <Label>Fournisseur</Label>
                  <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
                </div>
                <div>
                  <Label>TVA (%)</Label>
                  <Input type="number" step="0.01" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} />
                </div>
                <div>
                  <Label>Devise</Label>
                  <select className="w-full h-10 rounded-md border px-3" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                    <option value="TND">TND</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
            </div>
            <div>
              <Button type="submit">{editing ? 'Enregistrer les modifications' : 'Enregistrer'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {canManage && (
        <Button
          onClick={openNew}
          className="fixed bottom-6 right-6 rounded-full h-12 w-12 p-0 shadow-lg"
          title="Ajouter un produit"
        >
          +
        </Button>
      )}
    </div>
  );
}
