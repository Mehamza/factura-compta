import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Tables } from '@/integrations/supabase/types';

type Account = Tables<'accounts'>;

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  // accountBalance: current computed balance (debit - credit)
  accountBalance?: number;
  // optional preselected counterpart account id
  defaultCounterpartyAccountId?: string | null;
  onSave: (data: { code: string; name: string; type: string; balance?: number; counterparty_account_id?: string | null }) => void;
  loading: boolean;
}

const accountTypes = [
  { value: 'actif', label: 'Actif' },
  { value: 'passif', label: 'Passif' },
  { value: 'charge', label: 'Charge' },
  { value: 'produit', label: 'Produit' },
];

export default function AccountDialog({ open, onOpenChange, account, accountBalance, defaultCounterpartyAccountId, onSave, loading }: AccountDialogProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('actif');
  const [balance, setBalance] = useState<string>('');
  const [counterparty, setCounterparty] = useState<string | null>(null);

  useEffect(() => {
    if (account) {
      setCode(account.code);
      setName(account.name);
      setType(account.type);
      setBalance('');
      setCounterparty(defaultCounterpartyAccountId ?? null);
    } else {
      setCode('');
      setName('');
      setType('actif');
    }
  }, [account, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedBalance = balance === '' ? undefined : Number(parseFloat(balance).toFixed(2));
    onSave({ code, name, type, balance: parsedBalance, counterparty_account_id: counterparty });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{account ? 'Modifier le compte' : 'Nouveau compte'}</DialogTitle>
          <DialogDescription>
            {account ? 'Modifiez les informations du compte.' : 'Créez un nouveau compte comptable.'}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 overflow-auto">
          <form id="account-form" onSubmit={handleSubmit} className="space-y-4 pr-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code du compte</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: 411000"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nom du compte</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Clients"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type de compte</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="balance">Solde (optionnel)</Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder={account ? 'Laisser vide pour ne pas ajuster' : '0.00'}
              />
              <p className="text-sm text-muted-foreground">Si vous renseignez un solde, une écriture d'ajustement sera créée.</p>
            </div>
          </form>
        </ScrollArea>
        <DialogFooter className="flex-shrink-0 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="account-form" disabled={loading}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
