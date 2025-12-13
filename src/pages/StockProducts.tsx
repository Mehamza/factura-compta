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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface Category { id: string; name: string }
interface Product {
  id: string;
  name: string;
  sku: string;
  category_id: string | null;
  description: string | null;
  unit: string;
  purchase_price: number;
  sale_price: number;
  quantity: number;
  min_stock: number;
  vat_rate: number;
}

export default function StockProducts() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '', sku: '', category_id: '', description: '', unit: 'pièce',
    purchase_price: '', sale_price: '', quantity: '', min_stock: '', vat_rate: ''
  });

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    const [catRes, prodRes] = await Promise.all([
      supabase.from('product_categories').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
    ]);
    setCategories(catRes.data || []);
    setProducts(prodRes.data || []);
    setLoading(false);
    const low = (prodRes.data || []).filter(p => Number(p.quantity) <= Number(p.min_stock));
    if (low.length > 0) {
      toast({ title: 'Stock faible', description: `${low.length} produit(s) en dessous du stock minimum` });
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', sku: '', category_id: '', description: '', unit: 'pièce', purchase_price: '', sale_price: '', quantity: '', min_stock: '', vat_rate: '' });
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      category_id: p.category_id || '',
      description: p.description || '',
      unit: p.unit || 'pièce',
      purchase_price: String(p.purchase_price ?? ''),
      sale_price: String(p.sale_price ?? ''),
      quantity: String(p.quantity ?? ''),
      min_stock: String(p.min_stock ?? ''),
      vat_rate: String(p.vat_rate ?? ''),
    });
    setDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast({ variant: 'destructive', title: 'Erreur', description: 'Le nom du produit est obligatoire.' }); return; }
    if (!form.sku.trim()) { toast({ variant: 'destructive', title: 'Erreur', description: 'Le code produit (SKU) est obligatoire.' }); return; }
    const qty = Number(form.quantity || 0);
    const min = Number(form.min_stock || 0);
    const purchase = Number(form.purchase_price || 0);
    const sale = Number(form.sale_price || 0);
    const vat = Number(form.vat_rate || 0);
    if (qty < 0) { toast({ variant: 'destructive', title: 'Erreur', description: 'La quantité initiale ne peut pas être négative.' }); return; }
    if (min < 0) { toast({ variant: 'destructive', title: 'Erreur', description: 'Le stock minimum ne peut pas être négatif.' }); return; }
    if (purchase < 0 || sale < 0) { toast({ variant: 'destructive', title: 'Erreur', description: 'Les prix doivent être supérieurs ou égaux à 0.' }); return; }
    if (vat < 0 || vat > 100) { toast({ variant: 'destructive', title: 'Erreur', description: 'La TVA doit être comprise entre 0 et 100%.' }); return; }
    const payload = {
      user_id: user?.id,
      name: form.name,
      sku: form.sku,
      category_id: form.category_id || null,
      description: form.description || null,
      unit: form.unit,
      purchase_price: Number(form.purchase_price || 0),
      sale_price: Number(form.sale_price || 0),
      quantity: Number(form.quantity || 0),
      min_stock: Number(form.min_stock || 0),
      vat_rate: Number(form.vat_rate || 0),
    };
    if (editing) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
      if (error) toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      else { toast({ title: 'Succès', description: 'Produit modifié' }); setDialogOpen(false); load(); }
    } else {
      const { error } = await supabase.from('products').insert(payload);
      if (error) toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      else { toast({ title: 'Succès', description: 'Produit ajouté' }); setDialogOpen(false); load(); }
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Supprimer ce produit ?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    else { toast({ title: 'Succès', description: 'Produit supprimé' }); load(); }
  };

  const filtered = useMemo(() => (
    products.filter(p => (
      (p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())) &&
      (categoryFilter === 'all' || p.category_id === categoryFilter)
    ))
  ), [products, search, categoryFilter]);

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
          {(role === 'admin' || role === 'gerant') && <Button onClick={openNew}>Ajouter produit</Button>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Input placeholder="Rechercher par nom ou SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Filtrer par catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {categories.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Quantité</TableHead>
                <TableHead>Stock minimum</TableHead>
                <TableHead>Prix d'achat</TableHead>
                <TableHead>Prix de vente</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Aucun produit</TableCell></TableRow>
              ) : filtered.map(p => {
                const low = Number(p.quantity) <= Number(p.min_stock);
                const catLabel = categories.find(c => c.id === p.category_id)?.name || '-';
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.sku}</TableCell>
                    <TableCell>{catLabel}</TableCell>
                    <TableCell>{Number(p.quantity).toLocaleString('fr-FR')}</TableCell>
                    <TableCell>{Number(p.min_stock).toLocaleString('fr-FR')}</TableCell>
                    <TableCell>{Number(p.purchase_price).toLocaleString('fr-FR')} DT</TableCell>
                    <TableCell>{Number(p.sale_price).toLocaleString('fr-FR')} DT</TableCell>
                    <TableCell>
                      {low ? <Badge variant="destructive">Stock faible</Badge> : <Badge variant="outline">Stock normal</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {(role === 'admin' || role === 'gerant') && <Button variant="outline" onClick={() => openEdit(p)}>Modifier</Button>}
                        {(role === 'admin' || role === 'gerant') && <Button variant="destructive" onClick={() => remove(p.id)}>Supprimer</Button>}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le produit' : 'Ajouter un produit'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Nom</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <Label>SKU</Label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
            </div>
            <div>
              <Label>Catégorie</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unité</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Prix d'achat</Label>
              <Input type="number" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
            </div>
            <div>
              <Label>Prix de vente</Label>
              <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
            </div>
            <div>
              <Label>Quantité initiale</Label>
              <Input type="number" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div>
              <Label>Stock minimum</Label>
              <Input type="number" step="0.01" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
            </div>
            <div>
              <Label>TVA (%)</Label>
              <Input type="number" step="0.01" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">{editing ? 'Enregistrer' : 'Ajouter'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
