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
import { Plus, Download, Trash2 } from 'lucide-react';
import { canCreateMovements, NO_PERMISSION_MSG } from '@/lib/permissions';
import { generateStockDocumentPDF } from '@/lib/generateStockDocumentPDF';

type Warehouse = { id: string; code: string; name: string };

type Product = {
  id: string;
  name: string;
  sku: string | null;
};

type StockDocumentRow = {
  id: string;
  document_type: 'transfer' | 'entry';
  document_number: string;
  created_at: string;
  note: string | null;
  source_warehouse_id: string | null;
  destination_warehouse_id: string | null;
};

type StockDocumentItemRow = {
  id: string;
  document_id: string;
  product_id: string;
  quantity: number;
};

export default function StockTransfer() {
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
    source_warehouse_id: '',
    destination_warehouse_id: '',
    note: '',
    items: [{ product_id: '', quantity: '' }],
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
      supabase.from('products').select('id, name, sku').eq('company_id', activeCompanyId).order('name'),
      supabase
        .from('stock_documents')
        .select('id, document_type, document_number, created_at, note, source_warehouse_id, destination_warehouse_id')
        .eq('company_id', activeCompanyId)
        .eq('document_type', 'transfer')
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
        .select('id, document_id, product_id, quantity')
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

  const addLine = () => setForm((f) => ({ ...f, items: [...f.items, { product_id: '', quantity: '' }] }));
  const removeLine = (index: number) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));

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

    if (!form.source_warehouse_id || !form.destination_warehouse_id) {
      toast({ variant: 'destructive', title: 'Champs requis', description: 'Source et destination sont obligatoires.' });
      return;
    }

    if (form.source_warehouse_id === form.destination_warehouse_id) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'La source et la destination doivent être différentes.' });
      return;
    }

    const items = form.items
      .map((it) => ({
        product_id: it.product_id,
        quantity: Number(it.quantity),
      }))
      .filter((it) => it.product_id && Number.isFinite(it.quantity) && it.quantity > 0);

    if (items.length === 0) {
      toast({ variant: 'destructive', title: 'Champs requis', description: 'Ajoutez au moins une ligne valide.' });
      return;
    }

    const { data: docId, error } = await supabase.rpc('create_stock_transfer_document', {
      p_company_id: activeCompanyId,
      p_source_warehouse_id: form.source_warehouse_id,
      p_destination_warehouse_id: form.destination_warehouse_id,
      p_items: items,
      p_note: form.note || null,
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      return;
    }

    toast({ title: 'Succès', description: 'Bon de transfert créé.' });
    setDialogOpen(false);
    setForm({ source_warehouse_id: '', destination_warehouse_id: '', note: '', items: [{ product_id: '', quantity: '' }] });
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
      documentType: 'transfer',
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
      sourceWarehouseName: warehousesById.get(docRow.source_warehouse_id || '')?.name || null,
      destinationWarehouseName: warehousesById.get(docRow.destination_warehouse_id || '')?.name || null,
      lines,
    });

    doc.save(`${docRow.document_number}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock / Bon de transfert</h1>
          <p className="text-muted-foreground">Transferts entre entrepôts (opération atomique + traçabilité).</p>
        </div>
        {canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
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
                  <TableHead>Source</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Lignes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Aucun bon de transfert
                    </TableCell>
                  </TableRow>
                ) : (
                  docs.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.document_number}</TableCell>
                      <TableCell>{new Date(d.created_at).toLocaleString('fr-FR')}</TableCell>
                      <TableCell>{warehousesById.get(d.source_warehouse_id || '')?.name || '—'}</TableCell>
                      <TableCell>{warehousesById.get(d.destination_warehouse_id || '')?.name || '—'}</TableCell>
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
            <DialogTitle>Nouveau bon de transfert</DialogTitle>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Entrepôt source</Label>
                <Select value={form.source_warehouse_id} onValueChange={(v) => setForm((f) => ({ ...f, source_warehouse_id: v }))}>
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

              <div>
                <Label>Entrepôt destination</Label>
                <Select
                  value={form.destination_warehouse_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, destination_warehouse_id: v }))}
                >
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
            </div>

            <div>
              <Label>Note</Label>
              <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lignes</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4" /> Ajouter
                </Button>
              </div>

              <div className="space-y-3">
                {form.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_180px_44px] gap-3 items-end">
                    <div>
                      <Label>Produit</Label>
                      <Select
                        value={it.product_id}
                        onValueChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            items: f.items.map((x, i) => (i === idx ? { ...x, product_id: v } : x)),
                          }))
                        }
                      >
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
                      <Input
                        type="number"
                        step="0.01"
                        value={it.quantity}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            items: f.items.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)),
                          }))
                        }
                      />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeLine(idx)}
                      disabled={form.items.length <= 1}
                      aria-label="Supprimer la ligne"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
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
