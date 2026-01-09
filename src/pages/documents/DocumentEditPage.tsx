import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type SourceInvoiceOption = {
  id: string;
  invoice_number: string;
  clients?: { name?: string | null } | null;
  suppliers?: { name?: string | null } | null;
};

export default function DocumentEditPage({ kind }: { kind: DocumentKind }) {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { config, getById, update, handleStockMovement } = useInvoices(kind);
  const { companySettings } = useCompanySettings();
  const { activeCompanyId } = useAuth();

  const isCreditNote = isCreditNoteKind(kind);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(config.defaultStatus);

  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [validityDate, setValidityDate] = useState('');
  const [clientId, setClientId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [stampIncluded, setStampIncluded] = useState(false);
  const [currency, setCurrency] = useState(companySettings?.default_currency || 'TND');
  const [discount, setDiscount] = useState<DiscountConfig>({ type: 'percent', value: 0 });

  const [sourceInvoiceId, setSourceInvoiceId] = useState<string>('');
  const [sourceInvoices, setSourceInvoices] = useState<SourceInvoiceOption[]>([]);
  const [loadingSourceInvoices, setLoadingSourceInvoices] = useState(false);

  const defaultVatRate = companySettings?.default_vat_rate ?? 19;

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [itemProductMap, setItemProductMap] = useState<Record<number, string>>({});
  const [manualLines, setManualLines] = useState<Record<number, boolean>>({});

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

    setLoadingSourceInvoices(true);
    supabase
      .from('invoices')
      .select('id, invoice_number, clients(name), suppliers(name)')
      .eq('company_id', activeCompanyId)
      .in('document_kind', allowedSourceKinds as any)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast({ variant: 'destructive', title: 'Erreur', description: error.message });
          setSourceInvoices([]);
        } else {
          setSourceInvoices((data || []) as any);
        }
      })
      .finally(() => setLoadingSourceInvoices(false));
  }, [activeCompanyId, isCreditNote, kind, toast]);

  // Load invoice data
  const loadInvoice = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { invoice, items: invoiceItems, error } = await getById(id);
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      navigate('..');
      return;
    }
    if (!invoice) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Document non trouvé' });
      navigate('..');
      return;
    }

    setIssueDate(invoice.issue_date || '');
    setDueDate(invoice.due_date || '');
    setValidityDate(invoice.validity_date || '');
    setStatus(invoice.status || config.defaultStatus);
    setClientId(invoice.client_id || '');
    setSupplierId(invoice.supplier_id || '');
    setNotes(invoice.notes || '');
    setStampIncluded(invoice.stamp_included || false);
    setCurrency(invoice.currency || 'TND');
    setSourceInvoiceId((invoice as any).source_invoice_id || '');

    const loadedItems: InvoiceItem[] = invoiceItems.map((item: any) => ({
      id: item.id,
      reference: item.reference || '',
      description: item.description || '',
      quantity: item.quantity || 1,
      unit_price: item.unit_price || 0,
      vat_rate: item.vat_rate ?? defaultVatRate,
      vat_amount: item.vat_amount || 0,
      fodec_applicable: item.fodec_applicable || false,
      fodec_rate: item.fodec_rate || 0.01,
      fodec_amount: item.fodec_amount || 0,
      total: item.total || 0,
    }));

    if (loadedItems.length === 0) {
      loadedItems.push({
        reference: '',
        description: '',
        quantity: 1,
        unit_price: 0,
        vat_rate: defaultVatRate,
        vat_amount: 0,
        fodec_applicable: false,
        fodec_rate: 0.01,
        fodec_amount: 0,
        total: 0,
      });
    }

    setItems(loadedItems);
    // All loaded items are considered manual (editable)
    const manual: Record<number, boolean> = {};
    loadedItems.forEach((_, i) => {
      manual[i] = true;
    });
    setManualLines(manual);
    setLoading(false);
  }, [id, getById, toast, navigate, config.defaultStatus, defaultVatRate]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

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

      await update(id!, {
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

      toast({ title: 'Succès', description: `${config.label} mis à jour avec succès` });
      navigate('..');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err?.message || 'Modification impossible' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('..')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold">Modifier — {config.label}</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="text-sm text-muted-foreground">Modifiez les informations du document</div>
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
                    onValueChange={setSourceInvoiceId}
                    disabled={loadingSourceInvoices || Boolean(sourceInvoiceId)}
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

              {kind === 'devis' && (
                <div className="space-y-2">
                  <Label>Date de validité</Label>
                  <Input type="date" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} />
                </div>
              )}

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
              manualLines={manualLines}
              priceType={priceType}
              defaultVatRate={defaultVatRate}
              onProductSelect={handleProductSelect}
              onManualEntry={handleManualEntry}
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
              <Button type="button" variant="outline" onClick={() => navigate('..')} disabled={submitting}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
