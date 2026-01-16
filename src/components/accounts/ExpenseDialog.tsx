import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';

export type ExpenseFormData = {
  amount: number;
  expense_date: string;
  account_id: string;
  category: string;
  description: string;
  payment_method: string;
  reference: string;
  file?: File | null;
};

type CompteOption = {
  id: string;
  name: string;
  currency?: string | null;
  account_kind?: string | null;
};

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comptes: CompteOption[];
  onSave: (data: ExpenseFormData) => void;
  loading: boolean;
}

const paymentMethods = [
  { value: 'espèces', label: 'Espèces' },
  { value: 'chèque', label: 'Chèque' },
  { value: 'virement', label: 'Virement' },
  { value: 'carte', label: 'Carte' },
  { value: 'autre', label: 'Autre' },
];

const predefinedCategories = [
  'Loyer',
  'Électricité',
  'Eau',
  'Internet',
  'Téléphone',
  'Carburant',
  'Transport',
  'Fournitures',
  'Maintenance',
  'Salaires',
  'Impôts & taxes',
  'Autre',
];

export default function ExpenseDialog({ open, onOpenChange, comptes, onSave, loading }: ExpenseDialogProps) {
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState('');
  const [categoryMode, setCategoryMode] = useState<'predefined' | 'custom'>('predefined');
  const [category, setCategory] = useState(predefinedCategories[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('espèces');
  const [reference, setReference] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const comptesSorted = useMemo(() => (comptes || []).slice().sort((a, b) => a.name.localeCompare(b.name)), [comptes]);

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setAccountId(comptesSorted[0]?.id || '');
    setCategoryMode('predefined');
    setCategory(predefinedCategories[0]);
    setCustomCategory('');
    setDescription('');
    setPaymentMethod('espèces');
    setReference('');
    setFile(null);
  }, [open, comptesSorted]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) return;
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    const finalCategory = categoryMode === 'custom' ? customCategory.trim() : category;
    if (!finalCategory) return;

    onSave({
      amount: parsed,
      expense_date: expenseDate,
      account_id: accountId,
      category: finalCategory,
      description: description.trim(),
      payment_method: paymentMethod,
      reference: reference.trim(),
      file,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Nouvelle dépense</DialogTitle>
          <DialogDescription>Enregistrez une dépense (charge) sur un compte.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <form id="expense-form" onSubmit={handleSubmit} className="space-y-4 pr-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Montant *</Label>
                <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Compte *</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un compte" />
                </SelectTrigger>
                <SelectContent>
                  {comptesSorted.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.currency ? `(${c.currency})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select
                value={categoryMode}
                onValueChange={(v) => setCategoryMode(v === 'custom' ? 'custom' : 'predefined')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="predefined">Liste</SelectItem>
                  <SelectItem value="custom">Texte libre</SelectItem>
                </SelectContent>
              </Select>

              {categoryMode === 'predefined' ? (
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {predefinedCategories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Ex: Frais de dossier" />
              )}
            </div>

            <div className="space-y-2">
              <Label>Mode de paiement</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Référence</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° chèque, virement..." />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Raison / description..." rows={3} />
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
          <Button type="submit" form="expense-form" disabled={loading || !accountId || !amount}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
