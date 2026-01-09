import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useInvoices } from '@/hooks/useInvoices';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import type { DocumentKind } from '@/config/documentTypes';
import { getDocumentTypeConfig, documentTypeConfig, documentKindToRoute } from '@/config/documentTypes';
import { StatusBadge } from '@/components/invoices/shared';
import { calculateTotals, type InvoiceItem, STAMP_AMOUNT } from '@/components/invoices/shared/types';
import { generateInvoiceWithTemplate, type InvoiceTemplateData, type InvoiceItem as PDFInvoiceItem } from '@/lib/invoiceTemplates';
import { ArrowLeft, Pencil, Printer, Download, ArrowRight } from 'lucide-react';

export default function DocumentViewPage({ kind }: { kind: DocumentKind }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { config, getById, convert } = useInvoices(kind);
  const { companySettings } = useCompanySettings();

  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [converting, setConverting] = useState<DocumentKind | null>(null);

  const docConfig = getDocumentTypeConfig(kind);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { invoice: inv, items: itms, error } = await getById(id);
      if (error) {
        toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      } else {
        setInvoice(inv);
        setItems(itms);
      }
      setLoading(false);
    })();
  }, [id, getById, toast]);

  const handleConvert = async (targetKind: DocumentKind) => {
    if (!id) return;
    setConverting(targetKind);
    try {
      const newInvoice = await convert(id, targetKind);
      toast({ title: 'Succès', description: `Converti en ${documentTypeConfig[targetKind].label}` });
      // Navigate to the new document
      navigate(`${documentKindToRoute[targetKind]}/${newInvoice.id}`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err?.message || 'Erreur lors de la conversion' });
    } finally {
      setConverting(null);
    }
  };

  const handleGeneratePDF = async () => {
    if (!invoice || !companySettings) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Données manquantes pour générer le PDF' });
      return;
    }

    setGenerating(true);
    try {
      const invoiceItems: InvoiceItem[] = items.map(item => ({
        id: item.id,
        reference: item.reference || '',
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate || 0,
        vat_amount: item.vat_amount || 0,
        fodec_applicable: item.fodec_applicable,
        fodec_rate: item.fodec_rate,
        fodec_amount: item.fodec_amount || 0,
        total: item.total,
      }));

      const stampIncluded = invoice.stamp_included ?? false;
      const totals = calculateTotals(invoiceItems, stampIncluded);

      const pdfData: InvoiceTemplateData = {
        invoice_number: invoice.invoice_number,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date || invoice.issue_date,
        subtotal: invoice.subtotal || totals.subtotal,
        tax_rate: invoice.tax_rate || 19,
        tax_amount: invoice.tax_amount || totals.taxAmount,
        total: invoice.total || totals.total,
        fodec_amount_total: invoice.fodec_amount || totals.totalFodec,
        base_tva: totals.baseTVA,
        stamp_included: stampIncluded,
        stamp_amount: stampIncluded ? STAMP_AMOUNT : 0,
        discount_amount: totals.discountAmount,
        notes: invoice.notes,
        currency: invoice.currency || 'TND',
        template_type: invoice.template_type || 'classic',
        document_title: docConfig.label.toUpperCase(),
        client: invoice.clients ? {
          id: invoice.clients.id,
          name: invoice.clients.name,
          address: invoice.clients.address,
          city: invoice.clients.city,
          postal_code: invoice.clients.postal_code,
          phone: invoice.clients.phone,
          email: invoice.clients.email,
          siret: invoice.clients.siret,
          vat_number: invoice.clients.vat_number,
        } : invoice.suppliers ? {
          id: invoice.suppliers.id,
          name: invoice.suppliers.name,
          address: invoice.suppliers.address,
          city: invoice.suppliers.city,
          postal_code: invoice.suppliers.postal_code,
          phone: invoice.suppliers.phone,
          email: invoice.suppliers.email,
          siret: invoice.suppliers.siret,
          vat_number: invoice.suppliers.vat_number,
        } : undefined,
        company: companySettings ? {
          name: companySettings.legal_name || companySettings.company_name || '',
          address: companySettings.address || companySettings.company_address || '',
          city: companySettings.city || companySettings.company_city || '',
          postal_code: companySettings.postal_code || companySettings.company_postal_code || '',
          country: companySettings.company_country || '',
          phone: companySettings.phone || companySettings.company_phone || '',
          email: companySettings.email || companySettings.company_email || '',
          vat_number: companySettings.company_vat_number || '',
          tax_id: companySettings.company_tax_id || companySettings.matricule_fiscale || '',
          trade_register: companySettings.company_trade_register || '',
          logo_url: companySettings.logo_url || companySettings.company_logo_url || '',
          activity: companySettings.activity || '',
          signature_url: companySettings.signature_url || '',
          stamp_url: companySettings.stamp_url || '',
          bank_accounts: companySettings.bank_accounts || [],
        } : undefined,
      };

      const pdfItems: PDFInvoiceItem[] = items.map(item => ({
        reference: item.reference || '',
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate,
        vat_amount: item.vat_amount,
        fodec_applicable: item.fodec_applicable,
        fodec_rate: item.fodec_rate,
        fodec_amount: item.fodec_amount,
        total: item.total,
      }));

      await generateInvoiceWithTemplate(pdfData, pdfItems);
      toast({ title: 'Succès', description: 'PDF généré avec succès' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Erreur lors de la génération du PDF' });
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!invoice) {
    return <div className="text-center py-8 text-muted-foreground">Document non trouvé</div>;
  }

  const invoiceItems: InvoiceItem[] = items.map(item => ({
    id: item.id,
    reference: item.reference || '',
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    vat_rate: item.vat_rate || 0,
    vat_amount: item.vat_amount || 0,
    fodec_applicable: item.fodec_applicable,
    fodec_rate: item.fodec_rate,
    fodec_amount: item.fodec_amount || 0,
    total: item.total,
  }));
  const totals = calculateTotals(invoiceItems, invoice.stamp_included ?? false);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate('..')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{config.label} — {invoice.invoice_number}</h1>
          <p className="text-sm text-muted-foreground">{invoice.issue_date}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Imprimer
          </Button>
          <Button variant="outline" size="sm" onClick={handleGeneratePDF} disabled={generating}>
            <Download className="h-4 w-4 mr-2" /> {generating ? 'Génération...' : 'PDF'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`edit`)}>
            <Pencil className="h-4 w-4 mr-2" /> Modifier
          </Button>
        </div>
      </div>

      {/* Conversion Buttons */}
      {docConfig.canConvertTo.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Convertir en:</span>
              {docConfig.canConvertTo.map((targetKind) => {
                const targetConfig = documentTypeConfig[targetKind];
                return (
                  <Button
                    key={targetKind}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleConvert(targetKind)}
                    disabled={converting !== null}
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    {converting === targetKind ? 'Conversion...' : targetConfig.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <span className="font-medium">Statut: </span>
            <StatusBadge status={invoice.status} />
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{Number(invoice.total).toFixed(3)} TND</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Tiers</p>
              <p className="font-medium">{invoice.clients?.name || invoice.suppliers?.name || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Échéance</p>
              <p className="font-medium">{invoice.due_date || '—'}</p>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3">Réf</th>
                  <th className="text-left p-3">Description</th>
                  <th className="text-right p-3">Qté</th>
                  <th className="text-right p-3">P.U. HT</th>
                  <th className="text-right p-3">TVA</th>
                  <th className="text-right p-3">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3">{item.reference || '-'}</td>
                    <td className="p-3">{item.description}</td>
                    <td className="text-right p-3">{item.quantity}</td>
                    <td className="text-right p-3">{Number(item.unit_price).toFixed(3)}</td>
                    <td className="text-right p-3">{item.vat_rate || 0}%</td>
                    <td className="text-right p-3">{Number(item.total).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Sous-total HT:</span>
                <span>{totals.subtotal.toFixed(3)} TND</span>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Remise:</span>
                  <span>-{totals.discountAmount.toFixed(3)} TND</span>
                </div>
              )}
              {totals.totalFodec > 0 && (
                <div className="flex justify-between">
                  <span>FODEC:</span>
                  <span>{totals.totalFodec.toFixed(3)} TND</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Base TVA:</span>
                <span>{totals.baseTVA.toFixed(3)} TND</span>
              </div>
              <div className="flex justify-between">
                <span>Montant TVA:</span>
                <span>{totals.taxAmount.toFixed(3)} TND</span>
              </div>
              {invoice.stamp_included && (
                <div className="flex justify-between">
                  <span>Timbre fiscal:</span>
                  <span>{STAMP_AMOUNT.toFixed(3)} TND</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-2">
                <span>Total TTC:</span>
                <span>{totals.total.toFixed(3)} TND</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p>{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
