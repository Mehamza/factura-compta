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
  const [hasCategory, setHasCategory] = useState<boolean | null>(null);
  const [hasDescription, setHasDescription] = useState<boolean | null>(null);
  const [hasInitialQty, setHasInitialQty] = useState<boolean | null>(null);
  const [hasQuantity, setHasQuantity] = useState<boolean | null>(null);
  const [hasMinStock, setHasMinStock] = useState<boolean | null>(null);
  const [hasUnit, setHasUnit] = useState<boolean | null>(null);
  const [hasPurchasePrice, setHasPurchasePrice] = useState<boolean | null>(null);
  const [hasSalePrice, setHasSalePrice] = useState<boolean | null>(null);
  const [hasVatRate, setHasVatRate] = useState<boolean | null>(null);
  const [hasSupplier, setHasSupplier] = useState<boolean | null>(null);
  const [hasUnitPrice, setHasUnitPrice] = useState<boolean | null>(null);
  const [colMap, setColMap] = useState<Record<string, string | null>>({});
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
    const low = (prodRes.data || []).filter(p => {
      if (p.quantity == null || p.min_stock == null) return false;
      return Number(p.quantity) <= Number(p.min_stock);
    });
    if (low.length > 0) {
      toast({ title: 'Stock faible', description: `${low.length} produit(s) en dessous du stock minimum` });
    }

    // Prefer querying the DB metadata for reliable column names, fall back to row-inspection or select-probing
    try {
      const colsRes = await supabase.from('information_schema.columns').select('column_name').eq('table_name', 'products').eq('table_schema', 'public');
      if (!colsRes.error && Array.isArray(colsRes.data) && colsRes.data.length > 0) {
        const keys = (colsRes.data as Array<any>).map(r => String(r.column_name));
        const map: Record<string, string | null> = {
          category: keys.includes('category') ? 'category' : null,
          description: keys.includes('description') ? 'description' : null,
          initial_qty: keys.includes('initial_qty') ? 'initial_qty' : null,
          quantity: keys.includes('quantity') ? 'quantity' : null,
          min_stock: keys.includes('min_stock') ? 'min_stock' : null,
          unit: keys.includes('unit') ? 'unit' : null,
          purchase_price: keys.includes('purchase_price') ? 'purchase_price' : null,
          sale_price: keys.includes('sale_price') ? 'sale_price' : (keys.includes('unit_price') ? 'unit_price' : null),
          unit_price: keys.includes('unit_price') ? 'unit_price' : null,
          vat_rate: keys.includes('vat_rate') ? 'vat_rate' : null,
          supplier: keys.includes('supplier') ? 'supplier' : (keys.includes('supplier_id') ? 'supplier_id' : null),
        };
        setColMap(map);
        setHasCategory(!!map.category);
        setHasDescription(!!map.description);
        setHasInitialQty(!!map.initial_qty);
        setHasQuantity(!!map.quantity);
        setHasMinStock(!!map.min_stock);
        setHasUnit(!!map.unit);
        setHasPurchasePrice(!!map.purchase_price);
        setHasSalePrice(!!map.sale_price);
        setHasUnitPrice(!!map.unit_price);
        setHasVatRate(!!map.vat_rate);
        setHasSupplier(!!map.supplier);
      } else {
        // metadata not available or empty -> fallback to inspecting the first product row
        const first = (prodRes.data || [])[0] as Record<string, any> | undefined;
        if (first) {
          const keys = Object.keys(first);
          const map: Record<string, string | null> = {
            category: keys.includes('category') ? 'category' : null,
            description: keys.includes('description') ? 'description' : null,
            initial_qty: keys.includes('initial_qty') ? 'initial_qty' : null,
            quantity: keys.includes('quantity') ? 'quantity' : null,
            min_stock: keys.includes('min_stock') ? 'min_stock' : null,
            unit: keys.includes('unit') ? 'unit' : null,
            purchase_price: keys.includes('purchase_price') ? 'purchase_price' : null,
            sale_price: keys.includes('sale_price') ? 'sale_price' : (keys.includes('unit_price') ? 'unit_price' : null),
            unit_price: keys.includes('unit_price') ? 'unit_price' : null,
            vat_rate: keys.includes('vat_rate') ? 'vat_rate' : null,
            supplier: keys.includes('supplier') ? 'supplier' : (keys.includes('supplier_id') ? 'supplier_id' : null),
          };
          setColMap(map);
          setHasCategory(!!map.category);
          setHasDescription(!!map.description);
          setHasInitialQty(!!map.initial_qty);
          setHasQuantity(!!map.quantity);
          setHasMinStock(!!map.min_stock);
          setHasUnit(!!map.unit);
          setHasPurchasePrice(!!map.purchase_price);
          setHasSalePrice(!!map.sale_price);
          setHasUnitPrice(!!map.unit_price);
          setHasVatRate(!!map.vat_rate);
          setHasSupplier(!!map.supplier);
        } else {
          // no rows -> attempt fallback using simple selects (previous approach)
          const checks: Array<[string, (v: boolean) => void]> = [
            ['category', setHasCategory],
            ['description', setHasDescription],
            ['initial_qty', setHasInitialQty],
            ['quantity', setHasQuantity],
            ['min_stock', setHasMinStock],
            ['unit', setHasUnit],
            ['purchase_price', setHasPurchasePrice],
            ['sale_price', setHasSalePrice],
            ['vat_rate', setHasVatRate],
            ['supplier', setHasSupplier],
            ['unit_price', setHasUnitPrice],
          ];
          await Promise.all(checks.map(async ([col, setter]) => {
            try {
              const res = await supabase.from('products').select(col).limit(1);
              if (res.error) throw res.error;
              setter(true);
            } catch (e) {
              setter(false);
            }
          }));
        }
      }
    } catch (metaErr) {
      // If querying information_schema fails (permissions or RLS), fall back to row-inspection / select-probing
      const first = (prodRes.data || [])[0] as Record<string, any> | undefined;
      if (first) {
        const keys = Object.keys(first);
        const map: Record<string, string | null> = {
          category: keys.includes('category') ? 'category' : null,
          description: keys.includes('description') ? 'description' : null,
          initial_qty: keys.includes('initial_qty') ? 'initial_qty' : null,
          quantity: keys.includes('quantity') ? 'quantity' : null,
          min_stock: keys.includes('min_stock') ? 'min_stock' : null,
          unit: keys.includes('unit') ? 'unit' : null,
          purchase_price: keys.includes('purchase_price') ? 'purchase_price' : null,
          sale_price: keys.includes('sale_price') ? 'sale_price' : (keys.includes('unit_price') ? 'unit_price' : null),
          unit_price: keys.includes('unit_price') ? 'unit_price' : null,
          vat_rate: keys.includes('vat_rate') ? 'vat_rate' : null,
          supplier: keys.includes('supplier') ? 'supplier' : (keys.includes('supplier_id') ? 'supplier_id' : null),
        };
        setColMap(map);
        setHasCategory(!!map.category);
        setHasDescription(!!map.description);
        setHasInitialQty(!!map.initial_qty);
        setHasQuantity(!!map.quantity);
        setHasMinStock(!!map.min_stock);
        setHasUnit(!!map.unit);
        setHasPurchasePrice(!!map.purchase_price);
        setHasSalePrice(!!map.sale_price);
        setHasUnitPrice(!!map.unit_price);
        setHasVatRate(!!map.vat_rate);
        setHasSupplier(!!map.supplier);
      } else {
        const checks: Array<[string, (v: boolean) => void]> = [
          ['category', setHasCategory],
          ['description', setHasDescription],
          ['initial_qty', setHasInitialQty],
          ['quantity', setHasQuantity],
          ['min_stock', setHasMinStock],
          ['unit', setHasUnit],
          ['purchase_price', setHasPurchasePrice],
          ['sale_price', setHasSalePrice],
          ['vat_rate', setHasVatRate],
          ['supplier', setHasSupplier],
          ['unit_price', setHasUnitPrice],
        ];
        await Promise.all(checks.map(async ([col, setter]) => {
          try {
            const res = await supabase.from('products').select(col).limit(1);
            if (res.error) throw res.error;
            setter(true);
          } catch (e) {
            setter(false);
          }
        }));
      }
    }
  };

  const openNew = () => {
    if (!canManageProducts(role)) { toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG }); return; }
    setEditing(null);
    setForm({
      name: '', sku: '',
      initial_qty: hasInitialQty ? '' : '', quantity: hasQuantity ? '' : '', min_stock: hasMinStock ? '' : '', unit: hasUnit ? 'pièce' : '',
      purchase_price: hasPurchasePrice ? '' : '', sale_price: hasSalePrice ? '' : '', vat_rate: hasVatRate ? '19' : '',
      category: hasCategory ? 'Général' : '', description: hasDescription ? '' : '', supplier: hasSupplier ? '' : '', supplierCustom: ''
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
      initial_qty: hasInitialQty && colMap.initial_qty ? String((p as any)[colMap.initial_qty] ?? (colMap.quantity ? (p as any)[colMap.quantity] : '') ?? '') : '',
      quantity: hasQuantity && colMap.quantity ? String((p as any)[colMap.quantity] ?? '') : '',
      min_stock: hasMinStock && colMap.min_stock ? String((p as any)[colMap.min_stock] ?? '') : '',
      unit: hasUnit && colMap.unit ? String((p as any)[colMap.unit] ?? 'pièce') : '',
      purchase_price: hasPurchasePrice && colMap.purchase_price ? String((p as any)[colMap.purchase_price] ?? '') : '',
      sale_price: (hasSalePrice && colMap.sale_price) ? String((p as any)[colMap.sale_price] ?? (colMap.unit_price ? (p as any)[colMap.unit_price] : '') ?? '') : '',
      vat_rate: hasVatRate && colMap.vat_rate ? String((p as any)[colMap.vat_rate] ?? '19') : '',
      category: hasCategory && colMap.category ? String((p as any)[colMap.category] || 'Général') : '',
      description: hasDescription && colMap.description ? String((p as any)[colMap.description] || '') : '',
      supplier: hasSupplier && colMap.supplier ? String((p as any)[colMap.supplier] || '') : '',
      supplierCustom: '',
    });
    setDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageProducts(role)) { toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG }); return; }
    if (!form.name.trim()) { toast({ variant: 'destructive', title: 'Champs requis', description: 'Le nom du produit est obligatoire.' }); return; }
    if (!form.sku.trim()) { toast({ variant: 'destructive', title: 'Champs requis', description: 'Le SKU est obligatoire.' }); return; }
    if (hasCategory && !form.category.trim()) { toast({ variant: 'destructive', title: 'Champs requis', description: 'La catégorie est obligatoire.' }); return; }
    if (hasUnit && !form.unit.trim()) { toast({ variant: 'destructive', title: 'Champs requis', description: "L'unité est obligatoire." }); return; }
    if (hasVatRate && !form.vat_rate) { toast({ variant: 'destructive', title: 'Champs requis', description: 'Le taux de TVA est obligatoire.' }); return; }
    const initialQty = hasInitialQty ? Number(form.initial_qty || 0) : 0;
    const quantity = hasQuantity ? Number((editing ? form.quantity : form.initial_qty) || 0) : 0;
    const min = hasMinStock ? Number(form.min_stock || 0) : 0;
    const salePrice = hasSalePrice ? Number(form.sale_price || 0) : 0;
    const purchasePrice = hasPurchasePrice ? Number(form.purchase_price || 0) : 0;
    const vatRate = hasVatRate ? Number(form.vat_rate || 0) : 0;

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
      // include stock fields only if columns exist
      ...(hasQuantity ? { quantity } : {}),
      ...(hasMinStock ? { min_stock: min } : {}),
      ...(hasUnit ? { unit: form.unit } : {}),
      ...(hasInitialQty ? { initial_qty: Number(form.initial_qty || 0) } : {}),
      // pricing
      ...(hasPurchasePrice ? { purchase_price: purchasePrice } : {}),
      ...(hasSalePrice ? { sale_price: salePrice } : {}),
      ...(hasUnitPrice ? { unit_price: salePrice } : {}),
      ...(hasVatRate ? { vat_rate: vatRate } : {}),
      // meta
      ...(hasCategory ? { category: form.category.trim() } : {}),
      ...(hasDescription ? { description: form.description.trim() || null } : {}),
      ...(hasSupplier ? { supplier: resolvedSupplier } : {}),
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
    if (hasSalePrice === false) return 0;
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
                const qty = colMap.quantity ? Number((p as any)[colMap.quantity]) : NaN;
                const min = colMap.min_stock ? Number((p as any)[colMap.min_stock]) : NaN;
                const low = !isNaN(qty) && !isNaN(min) ? qty <= min : false;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.sku || '-'}</TableCell>
                    <TableCell>{hasQuantity && colMap.quantity ? Number((p as any)[colMap.quantity] ?? 0).toLocaleString('fr-FR') : '-'}</TableCell>
                    <TableCell>{hasMinStock && colMap.min_stock ? Number((p as any)[colMap.min_stock] ?? 0).toLocaleString('fr-FR') : '-'}</TableCell>
                    <TableCell>{(hasSalePrice || hasUnitPrice) ? Number((colMap.sale_price ? (p as any)[colMap.sale_price] : (colMap.unit_price ? (p as any)[colMap.unit_price] : 0)) ?? 0).toLocaleString('fr-FR') + ' DT' : '-'}</TableCell>
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
              {hasCategory !== false && (
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
              )}
              {hasDescription !== false && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Description</Label>
                  <Textarea placeholder="Notes internes ou description détaillée (optionnel)" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Visible en interne uniquement.</p>
                </div>
              )}
            </div>
            <Separator />

            <div className="text-sm font-medium text-muted-foreground">Stock</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(hasInitialQty !== false || hasQuantity !== false) && (
                <div className="space-y-2">
                  <Label>{editing ? 'Quantité' : 'Quantité initiale'}</Label>
                  <Input type="number" step="1" value={editing ? form.quantity : form.initial_qty} onChange={(e) => setForm({ ...form, [editing ? 'quantity' : 'initial_qty']: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Nombre d’unités actuellement en stock.</p>
                </div>
              )}
              {hasMinStock !== false && (
                <div className="space-y-2">
                  <Label>Stock minimum</Label>
                  <Input type="number" step="1" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Seuil d’alerte pour éviter les ruptures.</p>
                </div>
              )}
              {hasUnit !== false && (
                <div className="space-y-2">
                  <Label>Unité</Label>
                  <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                    <SelectTrigger><SelectValue placeholder="Unité" /></SelectTrigger>
                    <SelectContent>
                      {['pièce','kg','g','L','m','cm','boîte','paquet','lot'].map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <Separator />

            <div className="text-sm font-medium text-muted-foreground">Tarification</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {hasPurchasePrice !== false && (
                <div className="space-y-2">
                  <Label>Prix d'achat (DT)</Label>
                  <Input type="number" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
                </div>
              )}
              {hasSalePrice !== false && (
                <div className="space-y-2">
                  <Label>Prix de vente (DT)</Label>
                  <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
                </div>
              )}
              {hasVatRate !== false && (
                <div className="space-y-2">
                  <Label>TVA (%)</Label>
                  <Select value={form.vat_rate} onValueChange={(v) => setForm({ ...form, vat_rate: v })}>
                    <SelectTrigger><SelectValue placeholder="TVA" /></SelectTrigger>
                    <SelectContent>
                      {['0','7','13','19'].map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground">Prix TTC estimé: <span className="font-medium text-foreground">{ttc.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} DT</span></div>
            <Separator />

            <div className="text-sm font-medium text-muted-foreground">Fournisseur</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hasSupplier !== false && (
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
              )}
              {hasSupplier !== false && form.supplier === '__custom__' && (
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
