import { useMemo, useState, useEffect, type FormEvent } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Tables } from '@/integrations/supabase/types';
import { InvoicePaymentStatus, InvoiceStatus, isPayableStatus } from '@/lib/documentStatus';
import { ClientSupplierSelector } from '@/components/invoices/shared';

type Invoice = Tables<'invoices'>;
type Client = Tables<'clients'>;
type Supplier = Tables<'suppliers'>;
type Account = Tables<'accounts'>;

type PaymentType = 'vente' | 'achat';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: Invoice[];
  clients: Client[];
  suppliers: Supplier[];
  accounts: Account[];
  onSave: (data: {
    payment_type: PaymentType;
    invoice_id: string | null;
    client_id: string | null;
    supplier_id: string | null;
    amount: number;
    payment_date: string;
    payment_method: string;
    reference: string;
    notes: string;
    account_id: string;
    file?: File | null;
  }) => void;
  loading: boolean;
  editPayment?: {
    id: string;
    payment_type?: string | null;
    invoice_id: string | null;
    client_id?: string | null;
    supplier_id?: string | null;
    amount: number;
    payment_date: string;
    payment_method: string;
    reference: string | null;
    notes: string | null;
    account_id?: string | null;
    attachment_document_id?: string | null;
  } | null;
}

const paymentMethods = [
  { value: 'espèces', label: 'Espèces' },
  { value: 'virement', label: 'Virement bancaire' },
  { value: 'chèque', label: 'Chèque' },
  { value: 'carte', label: 'Carte bancaire' },
  { value: 'prélèvement', label: 'Prélèvement' },
  { value: 'autre', label: 'Autre' },
];

export default function PaymentDialog({ open, onOpenChange, invoices, clients, suppliers, accounts, onSave, loading, editPayment }: PaymentDialogProps) {
  const [paymentType, setPaymentType] = useState<PaymentType>('vente');
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('espèces');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (editPayment) {
      setPaymentType((editPayment.payment_type === 'achat' ? 'achat' : 'vente') as PaymentType);
      setInvoiceId(editPayment.invoice_id);
      setClientId(editPayment.client_id || '');
      setSupplierId(editPayment.supplier_id || '');
      setAccountId(editPayment.account_id || '');
      setAmount(String(editPayment.amount));
      setPaymentDate(editPayment.payment_date);
      setPaymentMethod(editPayment.payment_method);
      setReference(editPayment.reference || '');
      setNotes(editPayment.notes || '');
      setFile(null);
    } else {
      const accountList = accounts ?? [];
      setPaymentType('vente');
      setInvoiceId(null);
      setClientId('');
      setSupplierId('');
      setAccountId(accountList.length ? accountList[0].id : '');
      setAmount('');
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentMethod('espèces');
      setReference('');
      setNotes('');
      setFile(null);
    }
  }, [editPayment, open, accounts]);

  const handleInvoiceSelect = (value: string) => {
    const inv = invoices.find((i) => i.id === value);
    if (!value) {
      setInvoiceId(null);
      return;
    }

    setInvoiceId(value);

    // When an invoice is linked, the tier is forced by the invoice.
    if (inv) {
      const invClientId = (inv as unknown as { client_id?: string | null }).client_id;
      const invSupplierId = (inv as unknown as { supplier_id?: string | null }).supplier_id;
      setClientId(invClientId || '');
      setSupplierId(invSupplierId || '');
    }

    if (inv && !amount) {
      const invWithPayment = inv as Invoice & { remaining_amount?: number | null };
      const suggested = invWithPayment.remaining_amount ?? inv.total;
      setAmount(String(Number(suggested)));
    }
  };

  const selectedInvoice = useMemo(() => {
    if (!invoiceId) return null;
    return invoices.find((i) => i.id === invoiceId) || null;
  }, [invoiceId, invoices]);

  const selectedInvoiceAmounts = useMemo(() => {
    if (!selectedInvoice) return null;

    const total = Number((selectedInvoice as any).total ?? 0);
    const remainingFromDb = (selectedInvoice as any).remaining_amount;
    const totalPaid = Number((selectedInvoice as any).total_paid ?? 0);
    const remaining = Number(remainingFromDb ?? Math.max(total - totalPaid, 0));

    // For edit: allow up to (remaining + current payment amount) so the user can keep the same value.
    const editAllowance = editPayment && editPayment.invoice_id === invoiceId ? Number(editPayment.amount ?? 0) : 0;
    const maxAllowed = Math.max(remaining + editAllowance, 0);

    return { total, remaining, totalPaid, maxAllowed };
  }, [editPayment, invoiceId, selectedInvoice]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!accountId) return;

    if (invoiceId && selectedInvoiceAmounts) {
      const v = Number(amount);
      if (!Number.isFinite(v) || v <= 0) return;
      if (v > selectedInvoiceAmounts.maxAllowed + 1e-9) {
        setAmountError(`Le montant ne peut pas dépasser ${(selectedInvoiceAmounts.maxAllowed || 0).toFixed(3)}.`);
        return;
      }
    }

    if (!invoiceId) {
      if (paymentType === 'vente' && !clientId) return;
      if (paymentType === 'achat' && !supplierId) return;
    }
    onSave({
      payment_type: paymentType,
      invoice_id: invoiceId,
      client_id: clientId ? clientId : null,
      supplier_id: supplierId ? supplierId : null,
      amount: Number(amount),
      payment_date: paymentDate,
      payment_method: paymentMethod,
      reference,
      notes,
      account_id: accountId,
      file,
    });
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId) return '-';
    return clients.find((c) => c.id === clientId)?.name || '-';
  };

  const getSupplierName = (supplierId: string | null) => {
    if (!supplierId) return '-';
    return suppliers.find((s) => s.id === supplierId)?.name || '-';
  };

  const invoiceOptions = useMemo(() => {
    const invs = invoices as Array<Invoice & { document_kind?: string | null }>;

    const filteredByKind = invs.filter((i) => {
      const kind = i.document_kind;
      if (paymentType === 'vente') return kind === 'facture';
      return kind === 'facture_achat';
    });

    if (editPayment) return filteredByKind;

    const tierFiltered = filteredByKind.filter((i) => {
      // Load invoices only for the selected tier (client/supplier).
      if (paymentType === 'vente') {
        if (!clientId) return false;
        return (i.client_id || '') === clientId;
      }
      if (!supplierId) return false;
      return (i.supplier_id || '') === supplierId;
    });

    return tierFiltered.filter((i) => {
      if (!isPayableStatus(i.status)) return false;
      return i.status !== InvoicePaymentStatus.PAID;
    });
  }, [clientId, editPayment, invoices, paymentType, supplierId]);

  const invoiceLinked = Boolean(invoiceId);
  const tierDisabled = invoiceLinked;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{editPayment ? 'Modifier le paiement' : 'Enregistrer un paiement'}</DialogTitle>
          <DialogDescription>
            {editPayment ? 'Modifiez les informations du paiement.' : 'Enregistrez un nouveau paiement sur une facture.'}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 overflow-auto">
          <form id="payment-form" onSubmit={handleSubmit} className="space-y-4 pr-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={paymentType} onValueChange={(v) => setPaymentType((v === 'achat' ? 'achat' : 'vente') as PaymentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vente">Vente (encaissement)</SelectItem>
                  <SelectItem value="achat">Achat (décaissement)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentType === 'vente' ? (
              <div className="space-y-2">
                <Label>Client {invoiceLinked ? '' : '*'}</Label>
                <ClientSupplierSelector type="client" value={clientId} onChange={setClientId} disabled={tierDisabled} />
                {!invoiceLinked && !clientId ? (
                  <p className="text-sm text-muted-foreground">Sélectionnez un client pour charger ses factures impayées/partiellement payées.</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Fournisseur {invoiceLinked ? '' : '*'}</Label>
                <ClientSupplierSelector type="supplier" value={supplierId} onChange={setSupplierId} disabled={tierDisabled} />
                {!invoiceLinked && !supplierId ? (
                  <p className="text-sm text-muted-foreground">Sélectionnez un fournisseur pour charger ses factures impayées/partiellement payées.</p>
                ) : null}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="invoice">Facture (optionnel)</Label>
              <Select
                value={invoiceId || 'none'}
                onValueChange={(v) => handleInvoiceSelect(v === 'none' ? '' : v)}
                disabled={!invoiceLinked && ((paymentType === 'vente' && !clientId) || (paymentType === 'achat' && !supplierId))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une facture" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Aucune facture --</SelectItem>
                  {invoiceOptions.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoice_number} -
                      {paymentType === 'vente' ? ` ${getClientName(inv.client_id)}` : ` ${getSupplierName(inv.supplier_id)}`} ({Number(inv.total).toLocaleString('fr-FR')} {inv.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!invoiceLinked && ((paymentType === 'vente' && !clientId) || (paymentType === 'achat' && !supplierId)) ? (
                <p className="text-sm text-muted-foreground">Sélectionnez d'abord un tiers.</p>
              ) : null}
              {!invoiceLinked && ((paymentType === 'vente' && clientId) || (paymentType === 'achat' && supplierId)) && invoiceOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune facture payable trouvée pour ce tiers.</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="account">Compte (caisse / banque) *</Label>
              <Select value={accountId || ''} onValueChange={(v) => setAccountId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un compte bancaire" />
                </SelectTrigger>
                <SelectContent>
                  {(accounts ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code ? `${a.code} - ${a.name}` : a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Montant *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.001"
                  min="0"
                  max={selectedInvoiceAmounts ? String(selectedInvoiceAmounts.maxAllowed) : undefined}
                  value={amount}
                  onChange={(e) => {
                    const next = e.target.value;
                    setAmount(next);

                    if (!invoiceId || !selectedInvoiceAmounts) {
                      setAmountError('');
                      return;
                    }

                    const v = Number(next);
                    if (!next) {
                      setAmountError('');
                      return;
                    }

                    if (!Number.isFinite(v)) {
                      setAmountError('Montant invalide.');
                      return;
                    }

                    if (v > selectedInvoiceAmounts.maxAllowed + 1e-9) {
                      setAmountError(`Le montant ne peut pas dépasser ${(selectedInvoiceAmounts.maxAllowed || 0).toFixed(3)}.`);
                      return;
                    }

                    setAmountError('');
                  }}
                  placeholder="0.00"
                  required
                />
                {amountError ? <div className="text-sm text-destructive">{amountError}</div> : null}
                {selectedInvoice ? (
                  <div className="text-sm text-muted-foreground">
                    <div>Total facture: {Number(selectedInvoice.total).toLocaleString('fr-FR')} {selectedInvoice.currency}</div>
                    {'remaining_amount' in (selectedInvoice as any) ? (
                      <div>Reste à payer: {Number((selectedInvoice as any).remaining_amount ?? 0).toLocaleString('fr-FR')} {selectedInvoice.currency}</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_date">Date du paiement *</Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payment_method">Mode de paiement</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Référence</Label>
                <Input
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="N° chèque, virement..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes supplémentaires..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Pièce jointe (optionnel)</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <p className="text-sm text-muted-foreground">Stocké dans Documents (bucket). Max ~10MB recommandé.</p>
            </div>
          </form>
        </ScrollArea>
        <DialogFooter className="flex-shrink-0 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="submit"
            form="payment-form"
            disabled={
              loading ||
              !amount ||
              !accountId ||
              Boolean(amountError) ||
              (!invoiceId && paymentType === 'vente' && !clientId) ||
              (!invoiceId && paymentType === 'achat' && !supplierId)
            }
          >
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
