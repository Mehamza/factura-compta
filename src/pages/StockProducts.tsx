import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { downloadCSV, mapProductsToCSV, exportServerCSV } from '@/lib/export';
import { canExportData } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Plus, Download, Package, AlertTriangle, TrendingUp, Boxes } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { canManageProducts, canDeleteProducts, NO_PERMISSION_MSG } from '@/lib/permissions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  min_stock: number;
  unit_price: number;
  initial_qty: number | null;
  unit: string | null;
  purchase_price: number | null;
  sale_price: number | null;
  vat_rate: number | null;
  fodec_applicable?: boolean | null;
  fodec_rate?: number | null; // stored as decimal (e.g., 0.01)
  category: string | null;
  description: string | null;
  supplier_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface Supplier {
  id: string;
  name: string;
}

export default function StockProducts() {
  const { user, role, activeCompanyId } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    initial_qty: '',
    quantity: '',
    min_stock: '',
    unit: 'pièce',
    purchase_price: '',
    sale_price: '',
    unit_price: '',
    vat_rate: '19',
    fodec_applicable: false as boolean,
    fodec_rate_percent: '1' as string, // UI as percent, persisted as decimal
    category: '',
    description: '',
    supplier_id: '',
  });

  const canExport = canExportData(role);

  const onExportCSV = async () => {
    if (!canExport) {
      toast({ variant: 'destructive', title: 'Permission refusée', description: "Vous n'avez pas l'autorisation d'exporter ces données." });
      return;
    }
    try {
      await exportServerCSV('products');
      toast({ title: 'Export serveur', description: 'Le téléchargement va démarrer.' });
    } catch (e) {
      const rows = mapProductsToCSV(products as any);
      downloadCSV('produits', rows);
      toast({ title: 'Export CSV (local)', description: `${rows.length} ligne(s)` });
    }
  };

  useEffect(() => {
    if (user && activeCompanyId) load();
  }, [user, activeCompanyId]);

  const load = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    const [prodRes, suppRes] = await Promise.all([
      supabase.from('products').select('*').eq('company_id', activeCompanyId).order('name'),
      supabase.from('suppliers').select('id, name').order('name')
    ]);
    
    if (prodRes.error) {
      toast({ variant: 'destructive', title: 'Erreur', description: prodRes.error.message });
    }
    setProducts((prodRes.data as Product[]) || []);
    setSuppliers((suppRes.data as Supplier[]) || []);
    setLoading(false);

    // Check for low stock
    const low = (prodRes.data || []).filter(p => Number(p.quantity) <= Number(p.min_stock));
    if (low.length > 0) {
      toast({ title: 'Stock faible', description: `${low.length} produit(s) en dessous du stock minimum` });
    }
  };

  const openNew = () => {
    if (!canManageProducts(role)) {
      toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG });
      return;
    }
    setEditing(null);
    setForm({
      name: '',
      sku: '',
      initial_qty: '',
      quantity: '',
      min_stock: '',
      unit: 'pièce',
      purchase_price: '',
      sale_price: '',
      unit_price: '',
      vat_rate: '19',
      fodec_applicable: false,
      fodec_rate_percent: '1',
      category: '',
      description: '',
      supplier_id: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    if (!canManageProducts(role)) {
      toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG });
      return;
    }
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku || '',
      initial_qty: String(p.initial_qty ?? ''),
      quantity: String(p.quantity),
      min_stock: String(p.min_stock),
      unit: p.unit || 'pièce',
      purchase_price: String(p.purchase_price ?? ''),
      sale_price: String(p.sale_price ?? ''),
      unit_price: String(p.unit_price),
      vat_rate: String(p.vat_rate ?? '19'),
      fodec_applicable: Boolean(p.fodec_applicable ?? false),
      fodec_rate_percent: String((p.fodec_rate ?? 0.01) * 100),
      category: p.category || '',
      description: p.description || '',
      supplier_id: p.supplier_id || '',
    });
    setDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageProducts(role)) {
      toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG });
      return;
    }

    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: 'Champs requis', description: 'Le nom du produit est obligatoire.' });
      return;
    }

    const initial_qty = form.initial_qty ? Number(form.initial_qty) : 0;
    const quantity = editing ? Number(editing.quantity || 0) : 0;
    const min_stock = Number(form.min_stock || 0);
    const unit_price = Number(form.unit_price || form.sale_price || 0);
    const purchase_price = form.purchase_price ? Number(form.purchase_price) : null;
    const sale_price = form.sale_price ? Number(form.sale_price) : null;
    const vat_rate = form.vat_rate ? Number(form.vat_rate) : null;
    const fodec_applicable = Boolean(form.fodec_applicable);
    const fodec_rate = form.fodec_rate_percent ? Number(form.fodec_rate_percent) / 100 : (fodec_applicable ? 0.01 : 0);

    if (initial_qty < 0 || quantity < 0 || min_stock < 0 || unit_price < 0) {
      toast({ variant: 'destructive', title: 'Valeurs invalides', description: 'Les valeurs numériques doivent être positives.' });
      return;
    }

    // Check for duplicate SKU
    if (form.sku.trim()) {
      const duplicateSku = products.some(
        p => (p.sku || '').toLowerCase() === form.sku.trim().toLowerCase() && (!editing || p.id !== editing.id)
      );
      if (duplicateSku) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'SKU déjà utilisé pour un autre produit.' });
        return;
      }
    }

    const payload: any = {
      user_id: user?.id!,
      company_id: activeCompanyId,
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      quantity,
      min_stock,
      unit_price,
      unit: form.unit || null,
      purchase_price,
      sale_price,
      vat_rate,
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      supplier_id: form.supplier_id || null,
    };

    // Only include FODEC fields if schema supports them (products already loaded with '*')
    const supportsFodec = products.length > 0 && ('fodec_applicable' in (products[0] as any));
    if (supportsFodec) {
      payload.fodec_applicable = fodec_applicable;
      payload.fodec_rate = fodec_rate;
    }

    // For new products, store initial_qty but DO NOT apply stock silently.
    if (!editing) payload.initial_qty = initial_qty;
    // Never allow editing stock totals from this screen.
    if (editing) {
      delete payload.quantity;
      delete payload.initial_qty;
    }

    if (editing) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
      if (error) {
        toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      } else {
        toast({ title: 'Succès', description: 'Produit modifié' });
        setDialogOpen(false);
        await load();
      }
    } else {
      const { data: created, error } = await supabase.from('products').insert(payload).select('id').single();
      if (error) {
        toast({ variant: 'destructive', title: 'Erreur', description: error.message });
        return;
      }

      // If an initial quantity is provided, create it via a Bon d’entrée (document + movements).
      if (activeCompanyId && created?.id && initial_qty > 0) {
        const { data: whId, error: whErr } = await supabase.rpc('ensure_default_warehouse_id', { p_company_id: activeCompanyId });
        if (whErr) {
          toast({ variant: 'destructive', title: 'Erreur', description: whErr.message });
          return;
        }

        const { error: docErr } = await supabase.rpc('create_stock_entry_document', {
          p_company_id: activeCompanyId,
          p_warehouse_id: whId,
          p_items: [{ product_id: created.id, quantity: initial_qty, apply_pricing_updates: false }],
          p_note: 'initial_stock_product_create',
        });

        if (docErr) {
          toast({ variant: 'destructive', title: 'Erreur', description: docErr.message });
          return;
        }
      }

      toast({ title: 'Succès', description: 'Produit ajouté' });
      setDialogOpen(false);
      await load();
    }
  };

  const remove = async (id: string) => {
    if (!canDeleteProducts(role)) {
      toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG });
      return;
    }
    if (!confirm('Supprimer ce produit ?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      toast({ title: 'Succès', description: 'Produit supprimé' });
      load();
    }
  };

  const filtered = useMemo(
    () =>
      products.filter(
        p =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
          (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
      ),
    [products, search]
  );

  const canManage = canManageProducts(role);
  const canDelete = canDeleteProducts(role);

  // Calculate TTC price
  const ttc = useMemo(() => {
    const price = Number(form.sale_price || 0);
    const vatPercent = Number(form.vat_rate || 0);
    const fodecApplicable = Boolean(form.fodec_applicable);
    const fodecPercent = Number(form.fodec_rate_percent || (fodecApplicable ? '1' : '0'));
    if (isNaN(price) || isNaN(vatPercent) || isNaN(fodecPercent)) return 0;
    const ht = price;
    const fodec = fodecApplicable ? ht * (fodecPercent / 100) : 0;
    const baseTva = ht + fodec;
    const tva = baseTva * (vatPercent / 100);
    return ht + fodec + tva;
  }, [form.sale_price, form.vat_rate, form.fodec_applicable, form.fodec_rate_percent]);

  const getSupplierName = (supplierId: string | null) => {
    if (!supplierId) return '-';
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || '-';
  };

  // Stock summary statistics
  const stockStats = useMemo(() => {
    const totalProducts = products.length;
    const totalQuantity = products.reduce((sum, p) => sum + Number(p.quantity), 0);
    const lowStockCount = products.filter(p => Number(p.quantity) <= Number(p.min_stock)).length;
    const totalValue = products.reduce((sum, p) => sum + (Number(p.quantity) * Number(p.sale_price || p.unit_price || 0)), 0);
    return { totalProducts, totalQuantity, lowStockCount, totalValue };
  }, [products]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock / Produits</h1>
          <p className="text-muted-foreground">Gérez vos produits et quantités en stock.</p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" /> Ajouter produit
            </Button>
          )}
        </div>
      </div>

      {/* Stock Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Produits</p>
                <p className="text-2xl font-bold">{stockStats.totalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Boxes className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Stock total</p>
                <p className="text-2xl font-bold">{stockStats.totalQuantity.toLocaleString('fr-FR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stockStats.lowStockCount > 0 ? 'bg-destructive/10' : 'bg-green-500/10'}`}>
                <AlertTriangle className={`h-5 w-5 ${stockStats.lowStockCount > 0 ? 'text-destructive' : 'text-green-500'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Stock faible</p>
                <p className={`text-2xl font-bold ${stockStats.lowStockCount > 0 ? 'text-destructive' : ''}`}>{stockStats.lowStockCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valeur totale</p>
                <p className="text-2xl font-bold">{stockStats.totalValue.toLocaleString('fr-FR')} DT</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Input
                placeholder="Rechercher par nom, SKU ou catégorie"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {canExport && (
              <Button variant="outline" onClick={onExportCSV}>
                <Download className="h-4 w-4 mr-2" /> Exporter
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Quantité actuelle</TableHead>
                <TableHead>Stock min.</TableHead>
                <TableHead>Prix vente</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Aucun produit
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(p => {
                  const qty = Number(p.quantity);
                  const min = Number(p.min_stock);
                  const low = qty <= min;
                  const displayPrice = p.sale_price ?? p.unit_price;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.sku || '-'}</TableCell>
                      <TableCell>{p.category || '-'}</TableCell>
                      <TableCell>{qty.toLocaleString('fr-FR')} {p.unit || ''}</TableCell>
                      <TableCell>{min.toLocaleString('fr-FR')}</TableCell>
                      <TableCell>{Number(displayPrice).toLocaleString('fr-FR')} DT</TableCell>
                      <TableCell>
                        {low ? (
                          <Badge variant="destructive">Stock faible</Badge>
                        ) : (
                          <Badge variant="outline">Stock normal</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canManage ? (
                            <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                              Modifier
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" disabled title="Action non autorisée">
                              Modifier
                            </Button>
                          )}
                          {canDelete ? (
                            <Button variant="destructive" size="sm" onClick={() => remove(p.id)}>
                              Supprimer
                            </Button>
                          ) : (
                            <Button variant="destructive" size="sm" disabled title="Action non autorisée">
                              Supprimer
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le produit' : 'Ajouter un produit'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Informations de base</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom du produit *</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Nom du produit"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>SKU (Référence)</Label>
                  <Input
                    value={form.sku}
                    onChange={e => setForm({ ...form, sku: e.target.value })}
                    placeholder="SKU ou référence"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Input
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    placeholder="Ex: Électronique, Alimentation..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fournisseur</Label>
                  <Select value={form.supplier_id} onValueChange={v => setForm({ ...form, supplier_id: v === 'none' ? '' : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un fournisseur" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Description du produit..."
                  rows={2}
                />
              </div>
            </div>

            <Separator />

            {/* Stock Information */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Stock</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {!editing && (
                  <div className="space-y-2">
                    <Label>Quantité initiale</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.initial_qty}
                      onChange={e => setForm({ ...form, initial_qty: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                )}
                {editing && (
                  <div className="space-y-2">
                    <Label>Quantité actuelle</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.quantity}
                      readOnly
                      disabled
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">Le stock est géré par entrepôt via les bons (entrée/transfert). </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Stock minimum</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.min_stock}
                    onChange={e => setForm({ ...form, min_stock: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unité</Label>
                  <Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pièce">Pièce</SelectItem>
                      <SelectItem value="kg">Kilogramme (kg)</SelectItem>
                      <SelectItem value="g">Gramme (g)</SelectItem>
                      <SelectItem value="l">Litre (l)</SelectItem>
                      <SelectItem value="ml">Millilitre (ml)</SelectItem>
                      <SelectItem value="m">Mètre (m)</SelectItem>
                      <SelectItem value="m²">Mètre carré (m²)</SelectItem>
                      <SelectItem value="carton">Carton</SelectItem>
                      <SelectItem value="paquet">Paquet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Pricing Information */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Prix</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Prix d'achat HT (DT)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.purchase_price}
                    onChange={e => setForm({ ...form, purchase_price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prix de vente HT (DT)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.sale_price}
                    onChange={e => setForm({ ...form, sale_price: e.target.value, unit_price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Taux TVA (%)</Label>
                  <Select value={form.vat_rate} onValueChange={v => setForm({ ...form, vat_rate: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0% (Exonéré)</SelectItem>
                      <SelectItem value="7">7%</SelectItem>
                      <SelectItem value="13">13%</SelectItem>
                      <SelectItem value="19">19%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>FODEC</Label>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      id="fodec_applicable"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={form.fodec_applicable}
                      onChange={e => setForm({ ...form, fodec_applicable: e.target.checked })}
                    />
                    <Label htmlFor="fodec_applicable">Applicable</Label>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.fodec_rate_percent}
                    onChange={e => setForm({ ...form, fodec_rate_percent: e.target.value })}
                    disabled={!form.fodec_applicable}
                    placeholder="1"
                  />
                  <p className="text-xs text-muted-foreground">Taux (%) — par défaut 1%</p>
                </div>
                <div className="space-y-2">
                  <Label>Prix TTC (DT)</Label>
                  <Input
                    type="text"
                    value={ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                {editing ? 'Enregistrer' : 'Ajouter'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
