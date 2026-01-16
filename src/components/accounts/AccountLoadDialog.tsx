import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';

export type AccountLoadFormData = {
  account_id: string;
  amount: number;
  load_date: string;
  origin: string;
  notes: string;
  file?: File | null;
};

type CompteOption = {
  id: string;
  name: string;
  currency?: string | null;
  account_kind?: string | null;
};

interface AccountLoadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comptes: CompteOption[];
  onSave: (data: AccountLoadFormData) => void;
  loading: boolean;
}

const originPresets = [
  { value: 'capital', label: 'Capital' },
  { value: 'apport', label: 'Apport' },
  { value: 'autre', label: 'Autre (texte libre)' },
];

export default function AccountLoadDialog({ open, onOpenChange, comptes, onSave, loading }: AccountLoadDialogProps) {
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [loadDate, setLoadDate] = useState(new Date().toISOString().slice(0, 10));
  const [originMode, setOriginMode] = useState<'preset' | 'custom'>('preset');
  const [originPreset, setOriginPreset] = useState(originPresets[0].value);
  const [originCustom, setOriginCustom] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const comptesSorted = useMemo(() => (comptes || []).slice().sort((a, b) => a.name.localeCompare(b.name)), [comptes]);

  const selectedAccount = useMemo(() => {
    if (!accountId) return null;
    return comptesSorted.find((c) => c.id === accountId) || null;
  }, [accountId, comptesSorted]);

  const currency = selectedAccount?.currency || 'TND';

  useEffect(() => {
    if (!open) return;
    setAccountId(comptesSorted[0]?.id || '');
    setAmount('');
    setLoadDate(new Date().toISOString().slice(0, 10));
    setOriginMode('preset');
    setOriginPreset(originPresets[0].value);
    setOriginCustom('');
    setNotes('');
    setFile(null);
  }, [open, comptesSorted]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) return;

    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    const origin = originMode === 'custom' ? originCustom.trim() : originPreset;
    if (!origin) return;

    onSave({
      account_id: accountId,
      amount: parsed,
      load_date: loadDate,
      origin,
      notes: notes.trim(),
      file,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Charger le compte</DialogTitle>
          <DialogDescription>Encaissement autonome (ajoute au solde et génère une écriture comptable).</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <form id="account-load-form" onSubmit={handleSubmit} className="space-y-4 pr-4">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Montant ({currency}) *</Label>
                <Input type="number" step="0.001" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={loadDate} onChange={(e) => setLoadDate(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Origine</Label>
              <Select value={originMode} onValueChange={(v) => setOriginMode(v === 'custom' ? 'custom' : 'preset')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preset">Liste</SelectItem>
                  <SelectItem value="custom">Texte libre</SelectItem>
                </SelectContent>
              </Select>

              {originMode === 'preset' ? (
                <Select value={originPreset} onValueChange={setOriginPreset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {originPresets.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={originCustom} onChange={(e) => setOriginCustom(e.target.value)} placeholder="Ex: Apport associé, capital initial..." />
              )}
            </div>

            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes supplémentaires..." rows={3} />
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
          <Button type="submit" form="account-load-form" disabled={loading || !accountId || !amount}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
