import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useInvoices } from '@/hooks/useInvoices';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import type { DocumentKind } from '@/config/documentTypes';
import { isCreditNoteKind } from '@/config/documentTypes';
import {
  InvoiceItemsTable,
  InvoiceTotals,
  ClientSupplierSelector,
  calculateTotals,
  type InvoiceItem,
  type Product,
  type DiscountConfig,
} from '@/components/invoices/shared';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type SourceInvoiceOption = {
  id: string;
  invoice_number: string;
  client_id: string | null;
  supplier_id: string | null;
  issue_date: string | null;
  clients?: { name?: string | null } | null;
  suppliers?: { name?: string | null } | null;
};

export default function DocumentNewPage({ kind }: { kind: DocumentKind }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { config, create, handleStockMovement } = useInvoices(kind);
  const { companySettings } = useCompanySettings();
  const { activeCompanyId } = useAuth();

  const isCreditNote = isCreditNoteKind(kind);

  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(config.defaultStatus);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [validityDate, setValidityDate] = useState('');
  const [clientId, setClientId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [stampIncluded, setStampIncluded] = useState(false);
  const [currency] = useState(companySettings?.default_currency || 'TND');
  const [discount, setDiscount] = useState<DiscountConfig>({ type: 'percent', value: 0 });

  const [sourceInvoiceId, setSourceInvoiceId] = useState<string>('');
  const [sourceInvoices, setSourceInvoices] = useState<SourceInvoiceOption[]>([]);
  const [loadingSourceInvoices, setLoadingSourceInvoices] = useState(false);

  const defaultVatRate = companySettings?.default_vat_rate ?? 19;

  // Items state
  const [items, setItems] = useState<InvoiceItem[]>([
    { reference: '', description: '', quantity: 1, unit_price: 0, vat_rate: defaultVatRate, vat_amount: 0, fodec_applicable: false, fodec_rate: 0.01, fodec_amount: 0, total: 0 }
  ]);
  const [itemProductMap, setItemProductMap] = useState<Record<number, string>>({});
  const [manualLines, setManualLines] = useState<Record<number, boolean>>({ 0: true });

  const priceType = config.module === 'achats' ? 'purchase' : 'sale';

  const totals = useMemo(() => calculateTotals(items, stampIncluded, discount), [items, stampIncluded, discount]);

  useEffect(() => {
    if (!isCreditNote) return;
    setStampIncluded(false);
  }, [isCreditNote]);

  useEffect(() => {
    if (!isCreditNote || !activeCompanyId) return;
    const allowedSourceKinds = kind === 'facture_avoir'
      ? ['facture_credit', 'facture_payee']
      : ['facture_credit_achat'];

    let cancelled = false;
    (async () => {
      setLoadingSourceInvoices(true);
      try {
        const { data, error } = await supabase
          .from('invoices')
          .select('id, invoice_number, client_id, supplier_id, issue_date, clients(name), suppliers(name)')
          .eq('company_id', activeCompanyId)
          .in('document_kind', allowedSourceKinds as any)
          .order('created_at', { ascending: false });

        if (cancelled) return;

        if (error) {
          toast({ variant: 'destructive', title: 'Erreur', description: error.message });
          setSourceInvoices([]);
        } else {
          setSourceInvoices((data || []) as any);
        }
      } finally {
        if (!cancelled) setLoadingSourceInvoices(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCompanyId, isCreditNote, kind, toast]);

  const loadFromSourceInvoice = async (invoiceId: string) => {
    if (!invoiceId) return;
    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .select('id, client_id, supplier_id')
      .eq('id', invoiceId)
      .maybeSingle();
    if (invErr) throw invErr;
    if (!inv) throw new Error('Facture source introuvable');

    const { data: itms, error: itemsErr } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId);
    if (itemsErr) throw itemsErr;

    setClientId(inv.client_id || '');
    setSupplierId(inv.supplier_id || '');

    const negated: InvoiceItem[] = (itms || []).map((item: any) => {
      const quantity = Number(item.quantity ?? 1);
      const unitPrice = -Math.abs(Number(item.unit_price ?? 0));
      const ht = quantity * unitPrice;
      const fodecApplicable = Boolean(item.fodec_applicable);
      const fodecRate = Number(item.fodec_rate ?? 0.01);
      const fodecAmount = fodecApplicable ? ht * fodecRate : 0;
      const vatRate = Number(item.vat_rate ?? defaultVatRate);
      const vatAmount = (ht + fodecAmount) * (vatRate / 100);

      return {
        reference: item.reference || '',
        description: item.description || '',
        quantity,
        unit_price: unitPrice,
        vat_rate: vatRate,
        vat_amount: item.vat_amount != null ? -Math.abs(Number(item.vat_amount)) : vatAmount,
        fodec_applicable: fodecApplicable,
        fodec_rate: fodecRate,
        fodec_amount: item.fodec_amount != null ? -Math.abs(Number(item.fodec_amount)) : fodecAmount,
        total: item.total != null ? -Math.abs(Number(item.total)) : ht,
      };
    });

    if (negated.length > 0) {
      setItems(negated);
      const manual: Record<number, boolean> = {};
      negated.forEach((_, i) => (manual[i] = true));
      setManualLines(manual);
      setItemProductMap({});
    }
  };

  const handleProductSelect = (index: number, product: Product) => {
    setItemProductMap(prev => ({ ...prev, [index]: product.id }));
    setManualLines(prev => ({ ...prev, [index]: false }));

    const price = priceType === 'purchase' 
      ? (product.purchase_price ?? product.unit_price ?? 0)
      : (product.sale_price ?? product.unit_price ?? 0);
    const vatRate = product.vat_rate ?? defaultVatRate;
    const fodecApplicable = product.fodec_applicable ?? false;
    const fodecRate = product.fodec_rate ?? 0.01;

    const newItems = [...items];
    const qty = newItems[index].quantity || 1;
    const ht = qty * price;
    const fodecAmount = fodecApplicable ? ht * fodecRate : 0;
    const vatAmount = (ht + fodecAmount) * (vatRate / 100);

    newItems[index] = {
      ...newItems[index],
      reference: product.sku || '',
      description: product.name + (product.description ? ` - ${product.description}` : ''),
      unit_price: price,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      fodec_applicable: fodecApplicable,
      fodec_rate: fodecRate,
      fodec_amount: fodecAmount,
      total: ht,
    };
    setItems(newItems);
  };

  const handleManualEntry = (index: number) => {
    setManualLines(prev => ({ ...prev, [index]: true }));
    setItemProductMap(prev => {
      const newMap = { ...prev };
      delete newMap[index];
      return newMap;
    });
  };

  const handleReferenceChange = (index: number, text: string) => {
    // Treat typing as manual entry (but still allow selecting product from suggestions)
    handleUpdateItem(index, 'reference', text);
    setManualLines(prev => ({ ...prev, [index]: true }));
    setItemProductMap(prev => {
      const newMap = { ...prev };
      delete newMap[index];
      return newMap;
    });
  };

  const handleUpdateItem = (index: number, field: keyof InvoiceItem, value: string | number | boolean) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (['quantity', 'unit_price', 'vat_rate', 'fodec_applicable', 'fodec_rate'].includes(String(field))) {
      const ht = Number(newItems[index].quantity) * Number(newItems[index].unit_price);
      const fodecApplicable = Boolean(newItems[index].fodec_applicable);
      const fodecRate = Number(newItems[index].fodec_rate || 0.01);
      const fodecAmount = fodecApplicable ? ht * fodecRate : 0;
      const vatAmount = (ht + fodecAmount) * (Number(newItems[index].vat_rate) / 100);
      newItems[index].total = ht;
      newItems[index].fodec_amount = fodecAmount;
      newItems[index].vat_amount = vatAmount;
    }
    setItems(newItems);
  };

  const handleAddItem = () => {
    const newIndex = items.length;
    setItems([...items, { 
      reference: '', 
      description: '', 
      quantity: 1, 
      unit_price: 0, 
      vat_rate: defaultVatRate, 
      vat_amount: 0, 
      fodec_applicable: false, 
      fodec_rate: 0.01, 
      fodec_amount: 0, 
      total: 0 
    }]);
    setManualLines(prev => ({ ...prev, [newIndex]: true }));
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
    
    // Update maps
    const newProductMap: Record<number, string> = {};
    const newManualLines: Record<number, boolean> = {};
    Object.keys(itemProductMap).forEach(k => {
      const ki = Number(k);
      if (ki < index) newProductMap[ki] = itemProductMap[ki];
      else if (ki > index) newProductMap[ki - 1] = itemProductMap[ki];
    });
    Object.keys(manualLines).forEach(k => {
      const ki = Number(k);
      if (ki < index) newManualLines[ki] = manualLines[ki];
      else if (ki > index) newManualLines[ki - 1] = manualLines[ki];
    });
    setItemProductMap(newProductMap);
    setManualLines(newManualLines);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isCreditNote && !sourceInvoiceId) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Veuillez sélectionner une facture source' });
      return;
    }

    // Validation
    if (config.requiresClient && !clientId) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Veuillez sélectionner un client' });
      return;
    }
    if (config.requiresSupplier && !supplierId) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Veuillez sélectionner un fournisseur' });
      return;
    }
    if (items.every(i => !i.description && !i.reference)) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Veuillez ajouter au moins un article' });
      return;
    }

    setSubmitting(true);
    try {
      const invoiceItems = items.map(item => ({
        reference: item.reference || 'N/A',
        description: item.description || '',
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        vat_rate: Number(item.vat_rate) || 0,
        vat_amount: Number(item.vat_amount) || 0,
        fodec_applicable: Boolean(item.fodec_applicable),
        fodec_rate: Number(item.fodec_rate) || 0,
        fodec_amount: Number(item.fodec_amount) || 0,
        total: Number(item.total) || 0,
      }));

      const invoice = await create({
        issue_date: issueDate,
        due_date: dueDate,
        validity_date: validityDate || null,
        status,
        client_id: clientId || null,
        supplier_id: supplierId || null,
        notes: notes || null,
        currency,
        stamp_included: isCreditNote ? false : stampIncluded,
        stamp_amount: isCreditNote ? 0 : totals.stamp,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        fodec_amount: totals.totalFodec,
        total: totals.total,
        source_invoice_id: isCreditNote ? sourceInvoiceId : null,
      }, invoiceItems);

      // Handle stock movement for bon de livraison
      if (config.affectsStock && config.stockMovementType) {
        try {
          await handleStockMovement(invoice.id, config.stockMovementType);
          toast({ title: 'Stock mis à jour', description: 'Les mouvements de stock ont été enregistrés.' });
        } catch (stockErr: any) {
          toast({ variant: 'destructive', title: 'Attention', description: 'Document créé mais erreur stock: ' + stockErr?.message });
        }
      }

      toast({ title: 'Succès', description: `${config.label} créé avec succès` });
      navigate(-1);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err?.message || 'Création impossible' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="text-xl font-semibold">Nouveau — {config.label}</div>
          <div className="text-sm text-muted-foreground">Remplissez les informations du document</div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Header info */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {isCreditNote && (
                <div className="space-y-2 lg:col-span-2">
                  <Label>Facture source *</Label>
                  <Select
                    value={sourceInvoiceId}
                    onValueChange={async (v) => {
                      setSourceInvoiceId(v);
                      try {
                        await loadFromSourceInvoice(v);
                      } catch (err: any) {
                        toast({ variant: 'destructive', title: 'Erreur', description: err?.message || 'Chargement impossible' });
                      }
                    }}
                    disabled={loadingSourceInvoices}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingSourceInvoices ? 'Chargement...' : 'Sélectionner une facture'} />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceInvoices.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.invoice_number} — {inv.clients?.name || inv.suppliers?.name || ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* Client or Supplier selector */}
              {config.requiresClient && (
                <div className="space-y-2">
                  <Label>Client *</Label>
                  <ClientSupplierSelector
                    type="client"
                    value={clientId}
                    onChange={setClientId}
                    disabled={isCreditNote}
                  />
                </div>
              )}
              {config.requiresSupplier && (
                <div className="space-y-2">
                  <Label>Fournisseur *</Label>
                  <ClientSupplierSelector
                    type="supplier"
                    value={supplierId}
                    onChange={setSupplierId}
                    disabled={isCreditNote}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Date d'émission</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>

              {config.requiresDueDate && (
                <div className="space-y-2">
                  <Label>Date d'échéance</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              )}

              {kind === 'devis' ? (
                <div className="space-y-2">
                  <Label>Date de validité</Label>
                  <Input type="date" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    {config.statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Items table */}
            <InvoiceItemsTable
              items={items}
              itemProductMap={itemProductMap}
              priceType={priceType}
              defaultVatRate={defaultVatRate}
              onProductSelect={handleProductSelect}
              onReferenceChange={handleReferenceChange}
              onUpdateItem={handleUpdateItem}
              onAddItem={handleAddItem}
              onRemoveItem={handleRemoveItem}
            />

            {/* Totals */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Notes ou conditions particulières..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>
              <InvoiceTotals
                totals={totals}
                stampIncluded={stampIncluded}
                onStampChange={setStampIncluded}
                discount={discount}
                onDiscountChange={setDiscount}
                currency={currency}
                showStamp={config.module === 'ventes' && !isCreditNote}
                showDiscount={!isCreditNote}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={submitting}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Création...' : 'Créer le document'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
