import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Download } from 'lucide-react';
import { canCreateMovements, NO_PERMISSION_MSG } from '@/lib/permissions';
import { generateStockDocumentPDF } from '@/lib/generateStockDocumentPDF';

type Warehouse = { id: string; code: string; name: string; is_default?: boolean };

type Product = {
  id: string;
  name: string;
  sku: string | null;
  sale_price: number | null;
  vat_rate: number | null;
};

type StockDocumentRow = {
  id: string;
  document_type: 'transfer' | 'entry';
  document_number: string;
  created_at: string;
  note: string | null;
  warehouse_id: string | null;
};

type StockDocumentItemRow = {
  id: string;
  document_id: string;
  product_id: string;
  quantity: number;
  apply_pricing_updates: boolean;
  new_sale_price: number | null;
  new_vat_rate: number | null;
};

export default function StockEntry() {
  const { user, role, activeCompanyId } = useAuth();
  const { companySettings } = useCompanySettings();
  const { toast } = useToast();

  const canCreate = canCreateMovements(role);

  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [docs, setDocs] = useState<StockDocumentRow[]>([]);
  const [itemsByDoc, setItemsByDoc] = useState<Record<string, StockDocumentItemRow[]>>({});

  const [form, setForm] = useState({
    product_id: '',
    quantity: '',
    warehouse_id: '',
    note: '',
    apply_pricing_updates: false,
    new_sale_price: '',
    new_vat_rate: '',
  });

  const warehousesById = useMemo(() => {
    const map = new Map<string, Warehouse>();
    warehouses.forEach((w) => map.set(w.id, w));
    return map;
  }, [warehouses]);

  const productsById = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  const load = async () => {
    if (!activeCompanyId) return;
    setLoading(true);

    const [whRes, prodRes, docsRes] = await Promise.all([
      supabase.functions.invoke('warehouses', { body: { action: 'list', company_id: activeCompanyId } }),
      supabase.from('products').select('id, name, sku, sale_price, vat_rate').eq('company_id', activeCompanyId).order('name'),
      supabase
        .from('stock_documents')
        .select('id, document_type, document_number, created_at, note, warehouse_id')
        .eq('company_id', activeCompanyId)
        .eq('document_type', 'entry')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    if (whRes.error) {
      toast({ variant: 'destructive', title: 'Erreur', description: whRes.error.message });
    } else {
      setWarehouses(((whRes.data as any)?.data || []) as Warehouse[]);
    }

    if (prodRes.error) toast({ variant: 'destructive', title: 'Erreur', description: prodRes.error.message });
    setProducts((prodRes.data as Product[]) || []);

    if (docsRes.error) toast({ variant: 'destructive', title: 'Erreur', description: docsRes.error.message });
    const loadedDocs = (docsRes.data as StockDocumentRow[]) || [];
    setDocs(loadedDocs);

    if (loadedDocs.length > 0) {
      const ids = loadedDocs.map((d) => d.id);
      const { data: itemRows, error: iErr } = await supabase
        .from('stock_document_items')
        .select('id, document_id, product_id, quantity, apply_pricing_updates, new_sale_price, new_vat_rate')
        .in('document_id', ids);

      if (iErr) {
        toast({ variant: 'destructive', title: 'Erreur', description: iErr.message });
      } else {
        const grouped: Record<string, StockDocumentItemRow[]> = {};
        (itemRows as StockDocumentItemRow[]).forEach((it) => {
          grouped[it.document_id] = grouped[it.document_id] || [];
          grouped[it.document_id].push(it);
        });
        setItemsByDoc(grouped);
      }
    } else {
      setItemsByDoc({});
    }

    setLoading(false);
  };

  useEffect(() => {
    if (user && activeCompanyId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeCompanyId]);

  const openNew = async () => {
    if (!activeCompanyId) return;
    if (!canCreate) {
      toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG });
      return;
    }

    // Ensure default warehouse exists and preselect it.
    let wh = warehouses.find((w) => Boolean(w.is_default)) || warehouses[0];
    if (!wh) {
      const { data: ensuredId, error: eErr } = await supabase.rpc('ensure_default_warehouse_id', { p_company_id: activeCompanyId });
      if (eErr) {
        toast({ variant: 'destructive', title: 'Erreur', description: eErr.message });
      } else if (ensuredId) {
        // reload warehouses list to display label
        const whRes = await supabase.functions.invoke('warehouses', { body: { action: 'list', company_id: activeCompanyId } });
        if (!whRes.error) {
          const list = (((whRes.data as any)?.data || []) as Warehouse[]);
          setWarehouses(list);
          wh = list.find((w) => w.id === ensuredId) || list.find((w) => Boolean(w.is_default)) || list[0];
        }
      }
    }

    setForm({ product_id: '', quantity: '', warehouse_id: wh?.id || '', note: '', apply_pricing_updates: false, new_sale_price: '', new_vat_rate: '' });
    setDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeCompanyId) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Aucune société active.' });
      return;
    }

    if (!canCreate) {
      toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG });
      return;
    }

    // Flow validation: product -> qty -> warehouse -> pricing confirmation
    if (!form.product_id) {
      toast({ variant: 'destructive', title: 'Champs requis', description: 'Produit obligatoire.' });
      return;
    }

    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'La quantité doit être > 0.' });
      return;
    }

    if (!form.warehouse_id) {
      toast({ variant: 'destructive', title: 'Champs requis', description: 'Entrepôt obligatoire.' });
      return;
    }

    const newSale = form.new_sale_price === '' ? null : Number(form.new_sale_price);
    const newVat = form.new_vat_rate === '' ? null : Number(form.new_vat_rate);

    if (form.apply_pricing_updates) {
      if (newSale !== null && (!Number.isFinite(newSale) || newSale < 0)) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Prix de vente invalide.' });
        return;
      }
      if (newVat !== null && (!Number.isFinite(newVat) || newVat < 0)) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'TVA invalide.' });
        return;
      }
    }

    const items = [
      {
        product_id: form.product_id,
        quantity: qty,
        apply_pricing_updates: Boolean(form.apply_pricing_updates),
        new_sale_price: form.apply_pricing_updates ? newSale : null,
        new_vat_rate: form.apply_pricing_updates ? newVat : null,
      },
    ];

    const { data: docId, error } = await supabase.rpc('create_stock_entry_document', {
      p_company_id: activeCompanyId,
      p_warehouse_id: form.warehouse_id,
      p_items: items,
      p_note: form.note || null,
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      return;
    }

    toast({ title: 'Succès', description: "Bon d’entrée créé." });
    setDialogOpen(false);
    setForm({ product_id: '', quantity: '', warehouse_id: '', note: '', apply_pricing_updates: false, new_sale_price: '', new_vat_rate: '' });
    void docId;
    await load();
  };

  const onDownloadPDF = async (docRow: StockDocumentRow) => {
    const lines = (itemsByDoc[docRow.id] || []).map((it) => {
      const p = productsById.get(it.product_id);
      return {
        productName: p?.name || '—',
        sku: p?.sku || null,
        quantity: Number(it.quantity),
      };
    });

    const doc = await generateStockDocumentPDF({
      documentType: 'entry',
      documentNumber: docRow.document_number,
      createdAt: docRow.created_at,
      note: docRow.note,
      companyName: companySettings?.legal_name || null,
      company: companySettings
        ? {
            name: companySettings.legal_name,
            activity: companySettings.activity,
            address: companySettings.address,
            postal_code: companySettings.postal_code,
            city: companySettings.city,
            phone: companySettings.phone,
            email: companySettings.email,
            tax_id: companySettings.company_tax_id || companySettings.matricule_fiscale,
            trade_register: companySettings.company_trade_register,
            logo_url: companySettings.logo_url,
          }
        : null,
      warehouseName: warehousesById.get(docRow.warehouse_id || '')?.name || null,
      lines,
    });

    doc.save(`${docRow.document_number}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock / Bon d’entrée</h1>
          <p className="text-muted-foreground">Entrées en stock (opération atomique + historisation prix/TVA optionnelle).</p>
        </div>
        {canCreate && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> Nouveau
          </Button>
        )}
      </div>

      <Card>
        <CardHeader />
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Entrepôt</TableHead>
                  <TableHead>Lignes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Aucun bon d’entrée
                    </TableCell>
                  </TableRow>
                ) : (
                  docs.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.document_number}</TableCell>
                      <TableCell>{new Date(d.created_at).toLocaleString('fr-FR')}</TableCell>
                      <TableCell>{warehousesById.get(d.warehouse_id || '')?.name || '—'}</TableCell>
                      <TableCell>{(itemsByDoc[d.id] || []).length}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => onDownloadPDF(d)}>
                          <Download className="h-4 w-4" /> PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau bon d’entrée</DialogTitle>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Produit</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm((f) => ({ ...f, product_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Quantité</Label>
              <Input type="number" step="0.01" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
            </div>

            <div>
              <Label>Entrepôt</Label>
              <Select value={form.warehouse_id} onValueChange={(v) => setForm((f) => ({ ...f, warehouse_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.code} - {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Mettre à jour prix de vente / TVA</Label>
                <p className="text-xs text-muted-foreground">Appliqué uniquement si vous confirmez (historisé).</p>
              </div>
              <Switch checked={form.apply_pricing_updates} onCheckedChange={(v) => setForm((f) => ({ ...f, apply_pricing_updates: v }))} />
            </div>

            {form.apply_pricing_updates && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Nouveau prix de vente</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={form.product_id ? String(productsById.get(form.product_id)?.sale_price ?? '') : ''}
                    value={form.new_sale_price}
                    onChange={(e) => setForm((f) => ({ ...f, new_sale_price: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Nouvelle TVA (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={form.product_id ? String(productsById.get(form.product_id)?.vat_rate ?? '') : ''}
                    value={form.new_vat_rate}
                    onChange={(e) => setForm((f) => ({ ...f, new_vat_rate: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div>
              <Label>Note</Label>
              <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={!canCreate}>
                Créer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
