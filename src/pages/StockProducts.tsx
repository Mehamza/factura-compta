import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { downloadCSV, mapProductsToCSV, exportServerCSV } from '@/lib/export';
import { canExportData } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Plus, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { LoadingOverlay } from '@/components/ui/loader';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { canManageProducts, canDeleteProducts, NO_PERMISSION_MSG } from '@/lib/permissions';
import type { Tables } from '@/integrations/supabase/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

type Product = Tables<'products'>;

export default function StockProducts() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
    const canExport = canExportData(role);
    const onExportCSV = async () => {
      if (!canExport) {
        toast({ variant: 'destructive', title: 'Permission refusée', description: 'Vous n’avez pas l’autorisation d’exporter ces données.' });
        return;
      }
      try {
        await exportServerCSV('products');
        toast({ title: 'Export serveur', description: 'Le téléchargement va démarrer.' });
      } catch (e) {
        const rows = mapProductsToCSV(products);
        downloadCSV('produits', rows);
        toast({ title: 'Export CSV (local)', description: `${rows.length} ligne(s)` });
      }
    };
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    // Stock
    initial_qty: '',
    quantity: '',
    min_stock: '',
    unit: 'pièce',
    // Pricing
    purchase_price: '',
    sale_price: '',
    vat_rate: '19',
    // Meta
    category: 'Général',
    description: '',
    supplier: '',
    supplierCustom: '',
  });

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    const prodRes = await supabase.from('products').select('*').order('name');
    const suppRes = await supabase.from('suppliers').select('id,name').order('name');
    setProducts(prodRes.data || []);
    setSuppliers((suppRes.data as any) || []);
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
      name: '', sku: '',
      initial_qty: '', quantity: '', min_stock: '', unit: 'pièce',
      purchase_price: '', sale_price: '', vat_rate: '19',
      category: 'Général', description: '', supplier: '', supplierCustom: ''
    });
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    if (!canManageProducts(role)) { toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG }); return; }
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku || '',
      // For edit, show current quantity; keep initial_qty for reference
      initial_qty: String((p as any).initial_qty ?? p.quantity ?? ''),
      quantity: String(p.quantity ?? ''),
      min_stock: String(p.min_stock ?? ''),
      unit: String((p as any).unit || 'pièce'),
      purchase_price: String((p as any).purchase_price ?? ''),
      sale_price: String((p as any).sale_price ?? p.unit_price ?? ''),
      vat_rate: String((p as any).vat_rate ?? '19'),
      category: String((p as any).category || 'Général'),
      description: String((p as any).description || ''),
      supplier: String((p as any).supplier || ''),
      supplierCustom: '',
    });
    setDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageProducts(role)) { toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG }); return; }
    if (!form.name.trim()) { toast({ variant: 'destructive', title: 'Champs requis', description: 'Le nom du produit est obligatoire.' }); return; }
    if (!form.sku.trim()) { toast({ variant: 'destructive', title: 'Champs requis', description: 'Le SKU est obligatoire.' }); return; }
    if (!form.category.trim()) { toast({ variant: 'destructive', title: 'Champs requis', description: 'La catégorie est obligatoire.' }); return; }
    if (!form.unit.trim()) { toast({ variant: 'destructive', title: 'Champs requis', description: "L'unité est obligatoire." }); return; }
    if (!form.vat_rate) { toast({ variant: 'destructive', title: 'Champs requis', description: 'Le taux de TVA est obligatoire.' }); return; }
    const initialQty = Number(form.initial_qty || 0);
    const quantity = Number((editing ? form.quantity : form.initial_qty) || 0);
    const min = Number(form.min_stock || 0);
    const salePrice = Number(form.sale_price || 0);
    const purchasePrice = Number(form.purchase_price || 0);
    const vatRate = Number(form.vat_rate || 0);

    if (quantity < 0 || min < 0 || salePrice < 0 || purchasePrice < 0) {
      toast({ variant: 'destructive', title: 'Valeurs invalides', description: 'Les valeurs numériques doivent être positives.' });
      return;
    }
    if (!editing && initialQty < 0) {
      toast({ variant: 'destructive', title: 'Valeurs invalides', description: 'La quantité initiale doit être positive.' });
      return;
    }
    
    // Prevent duplicate SKU among existing products
    if (form.sku.trim()) {
      const duplicateSku = products.some(p => (p.sku || '').toLowerCase() === form.sku.trim().toLowerCase() && (!editing || p.id !== editing.id));
      if (duplicateSku) { toast({ variant: 'destructive', title: 'Erreur', description: 'SKU déjà utilisé pour un autre produit.' }); return; }
    }

    const resolvedSupplier = form.supplier === '__custom__' ? (form.supplierCustom.trim() || null) : (form.supplier || null);
    const payload: any = {
      user_id: user?.id!,
      name: form.name.trim(),
      sku: form.sku.trim(),
      // stock
      quantity,
      min_stock: min,
      unit: form.unit,
      initial_qty: Number(form.initial_qty || 0),
      // pricing
      purchase_price: purchasePrice,
      sale_price: salePrice,
      unit_price: salePrice,
      vat_rate: vatRate,
      // meta
      category: form.category.trim(),
      description: form.description.trim() || null,
      supplier: resolvedSupplier,
    };
    
    if (editing) {
      // On edit, initial_qty should not override if left empty
      if (!form.initial_qty) delete payload.initial_qty;
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
  const ttc = useMemo(() => {
    const p = Number(form.sale_price || 0);
    const t = Number(form.vat_rate || 0);
    if (isNaN(p) || isNaN(t)) return 0;
    return p * (1 + t / 100);
  }, [form.sale_price, form.vat_rate]);

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
          {canManage && <Button onClick={openNew}><Plus className="h-4 w-4" /> Ajouter produit</Button>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Input placeholder="Rechercher par nom ou SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {canExport && (
              <Button variant="outline" onClick={onExportCSV}><Download className="h-4 w-4" /> Exporter</Button>
            )}
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
                <TableHead>Prix de vente</TableHead>
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
                    <TableCell>{Number((p as any).sale_price ?? p.unit_price).toLocaleString('fr-FR')} DT</TableCell>
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
        <DialogContent className="max-w-3xl md:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le produit' : 'Ajouter un produit'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-6">
            <div className="text-sm font-medium text-muted-foreground">Informations de base</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom du produit *</Label>
                <Input autoFocus placeholder="Ex. Papier A4 80g" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <p className="text-xs text-muted-foreground">Nom tel qu’il apparaîtra sur les documents.</p>
              </div>
              <div className="space-y-2">
                <Label>Code produit / SKU *</Label>
                <Input placeholder="Ex. PPR-A4-80" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                <p className="text-xs text-muted-foreground">Identifiant unique de votre produit.</p>
              </div>
              <div className="space-y-2">
                <Label>Catégorie *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {['Général','Consommables','Matières premières','Services','Emballages','Pièces détachées','Autre'].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Textarea placeholder="Notes internes ou description détaillée (optionnel)" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <p className="text-xs text-muted-foreground">Visible en interne uniquement.</p>
              </div>
            </div>
            <Separator />

            <div className="text-sm font-medium text-muted-foreground">Stock</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{editing ? 'Quantité' : 'Quantité initiale'} *</Label>
                <Input type="number" step="1" value={editing ? form.quantity : form.initial_qty} onChange={(e) => setForm({ ...form, [editing ? 'quantity' : 'initial_qty']: e.target.value })} />
                <p className="text-xs text-muted-foreground">Nombre d’unités actuellement en stock.</p>
              </div>
              <div className="space-y-2">
                <Label>Stock minimum *</Label>
                <Input type="number" step="1" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
                <p className="text-xs text-muted-foreground">Seuil d’alerte pour éviter les ruptures.</p>
              </div>
              <div className="space-y-2">
                <Label>Unité *</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger><SelectValue placeholder="Unité" /></SelectTrigger>
                  <SelectContent>
                    {['pièce','kg','g','L','m','cm','boîte','paquet','lot'].map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />

            <div className="text-sm font-medium text-muted-foreground">Tarification</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Prix d'achat (DT) *</Label>
                <Input type="number" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Prix de vente (DT) *</Label>
                <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>TVA (%) *</Label>
                <Select value={form.vat_rate} onValueChange={(v) => setForm({ ...form, vat_rate: v })}>
                  <SelectTrigger><SelectValue placeholder="TVA" /></SelectTrigger>
                  <SelectContent>
                    {['0','7','13','19'].map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">Prix TTC estimé: <span className="font-medium text-foreground">{ttc.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} DT</span></div>
            <Separator />

            <div className="text-sm font-medium text-muted-foreground">Fournisseur</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fournisseur</Label>
                <Select value={form.supplier || 'none'} onValueChange={(v) => setForm({ ...form, supplier: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                    <SelectItem value="__custom__">Autre (saisie)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.supplier === '__custom__' && (
                <div className="space-y-2">
                  <Label>Nom du fournisseur</Label>
                  <Input value={form.supplierCustom} onChange={(e) => setForm({ ...form, supplierCustom: e.target.value })} />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit">{editing ? 'Enregistrer les modifications' : 'Enregistrer'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
