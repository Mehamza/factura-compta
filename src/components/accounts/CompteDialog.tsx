import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

export type CompteKind = 'caisse' | 'bank';
export type CompteCurrency = 'TND' | 'EUR' | 'USD';

export type CompteFormData = {
  kind: CompteKind;
  name: string;
  currency: CompteCurrency;
  bank?: string | null;
  agency?: string | null;
  iban?: string | null;
};

export type CompteEditModel = {
  id: string;
  name: string;
  account_kind?: string | null;
  currency?: string | null;
  bank?: string | null;
  agency?: string | null;
  iban?: string | null;
};

interface CompteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compte: CompteEditModel | null;
  onSave: (data: CompteFormData) => void;
  loading: boolean;
}

const currencies: { value: CompteCurrency; label: string }[] = [
  { value: 'TND', label: 'TND' },
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
];

// Minimal predefined bank list; can be extended later.
const banks = [
  'BCT',
  'BIAT',
  'BNA',
  'STB',
  'BH Bank',
  'Attijari Bank',
  'Amen Bank',
  'UIB',
  'Zitouna',
  'ATB',
  'UBCI',
  'BT',
  'Wifak',
  'Autre',
];

export default function CompteDialog({ open, onOpenChange, compte, onSave, loading }: CompteDialogProps) {
  const [kind, setKind] = useState<CompteKind>('caisse');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<CompteCurrency>('TND');
  const [bank, setBank] = useState<string>('');
  const [agency, setAgency] = useState('');
  const [iban, setIban] = useState('');

  const isBank = kind === 'bank';

  useEffect(() => {
    if (compte) {
      const k = (compte.account_kind || 'bank') as CompteKind;
      setKind(k === 'caisse' ? 'caisse' : 'bank');
      setName(compte.name || '');
      setCurrency(((compte.currency || 'TND') as CompteCurrency) || 'TND');
      setBank(compte.bank || '');
      setAgency(compte.agency || '');
      setIban(compte.iban || '');
    } else {
      setKind('caisse');
      setName('');
      setCurrency('TND');
      setBank('');
      setAgency('');
      setIban('');
    }
  }, [compte, open]);

  const bankOptions = useMemo(() => banks, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (isBank && !bank.trim()) return;

    onSave({
      kind,
      name: name.trim(),
      currency,
      bank: isBank ? bank.trim() : null,
      agency: isBank ? (agency.trim() || null) : null,
      iban: isBank ? (iban.trim() || null) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{compte ? 'Modifier le compte' : 'Nouveau compte'}</DialogTitle>
          <DialogDescription>
            {compte ? 'Modifiez les informations du compte.' : 'Créez une caisse ou un compte bancaire.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <form id="compte-form" onSubmit={handleSubmit} className="space-y-4 pr-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as CompteKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="caisse">Caisse</SelectItem>
                  <SelectItem value="bank">Compte bancaire</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={kind === 'caisse' ? 'Ex: Caisse principale' : 'Ex: BIAT - Compte principal'}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Devise</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as CompteCurrency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isBank ? (
              <>
                <div className="space-y-2">
                  <Label>Banque *</Label>
                  <Select value={bank || ''} onValueChange={setBank}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une banque" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankOptions.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agency">Agence</Label>
                  <Input id="agency" value={agency} onChange={(e) => setAgency(e.target.value)} placeholder="Ex: Tunis Centre" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="iban">IBAN</Label>
                  <Input id="iban" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="TN59...." />
                </div>
              </>
            ) : null}
          </form>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="compte-form" disabled={loading || !name.trim() || (isBank && !bank.trim())}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
