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
    quantity: '',
    min_stock: '',
    unit_price: '',
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
    setForm({ name: '', sku: '', quantity: '', min_stock: '', unit_price: '' });
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    if (!canManageProducts(role)) { toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG }); return; }
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku || '',
      quantity: String(p.quantity ?? ''),
      min_stock: String(p.min_stock ?? ''),
      unit_price: String(p.unit_price ?? ''),
    });
    setDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageProducts(role)) { toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG }); return; }
    if (!form.name.trim()) { toast({ variant: 'destructive', title: 'Champs requis', description: 'Le nom du produit est obligatoire.' }); return; }
    
    const quantity = Number(form.quantity || 0);
    const min = Number(form.min_stock || 0);
    const unitPrice = Number(form.unit_price || 0);
    
    if (quantity < 0 || min < 0 || unitPrice < 0) {
      toast({ variant: 'destructive', title: 'Valeurs invalides', description: 'Les valeurs numériques doivent être positives.' });
      return;
    }
    
    // Prevent duplicate SKU among existing products
    if (form.sku.trim()) {
      const duplicateSku = products.some(p => (p.sku || '').toLowerCase() === form.sku.trim().toLowerCase() && (!editing || p.id !== editing.id));
      if (duplicateSku) { toast({ variant: 'destructive', title: 'Erreur', description: 'SKU déjà utilisé pour un autre produit.' }); return; }
    }

    const payload = {
      user_id: user?.id!,
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      quantity,
      min_stock: min,
      unit_price: unitPrice,
    };
    
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le produit' : 'Ajouter un produit'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label>Nom du produit *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Code produit / SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantité</Label>
                  <Input type="number" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </div>
                <div>
                  <Label>Stock minimum</Label>
                  <Input type="number" step="1" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Prix unitaire (DT)</Label>
                <Input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
              </div>
            </div>
            <Button type="submit" className="w-full">{editing ? 'Enregistrer les modifications' : 'Enregistrer'}</Button>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
