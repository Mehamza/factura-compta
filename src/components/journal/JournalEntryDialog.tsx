import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Account = Tables<'accounts'>;

interface JournalLine {
  account_id: string;
  debit: number;
  credit: number;
}

interface JournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  onSave: (entry: { date: string; reference: string; description: string; lines: JournalLine[] }) => void;
  loading: boolean;
  editEntry?: {
    id: string;
    entry_date: string;
    reference: string;
    description: string | null;
    lines: JournalLine[];
  } | null;
}

export default function JournalEntryDialog({ open, onOpenChange, accounts, onSave, loading, editEntry }: JournalEntryDialogProps) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([
    { account_id: '', debit: 0, credit: 0 },
    { account_id: '', debit: 0, credit: 0 },
  ]);

  useEffect(() => {
    if (editEntry) {
      setDate(editEntry.entry_date);
      setReference(editEntry.reference);
      setDescription(editEntry.description || '');
      setLines(editEntry.lines.length > 0 ? editEntry.lines : [
        { account_id: '', debit: 0, credit: 0 },
        { account_id: '', debit: 0, credit: 0 },
      ]);
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setReference('');
      setDescription('');
      setLines([
        { account_id: '', debit: 0, credit: 0 },
        { account_id: '', debit: 0, credit: 0 },
      ]);
    }
  }, [editEntry, open]);

  const totals = useMemo(() => {
    const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
    return { totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  }, [lines]);

  const updateLine = (index: number, field: keyof JournalLine, value: string | number) => {
    const newLines = [...lines];
    if (field === 'account_id') {
      newLines[index].account_id = value as string;
    } else {
      newLines[index][field] = Number(value) || 0;
    }
    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { account_id: '', debit: 0, credit: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) {
      toast.error('Une écriture doit avoir au moins 2 lignes');
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validLines = lines.filter(l => l.account_id && (l.debit > 0 || l.credit > 0));
    if (validLines.length < 2) {
      toast.error('L\'écriture doit avoir au moins 2 lignes valides');
      return;
    }

    if (!totals.balanced) {
      toast.error('L\'écriture n\'est pas équilibrée (débit ≠ crédit)');
      return;
    }

    onSave({
      date,
      reference: reference || `REF-${Date.now()}`,
      description,
      lines: validLines,
    });
  };

  const getAccountLabel = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{editEntry ? 'Modifier l\'écriture' : 'Nouvelle écriture comptable'}</DialogTitle>
          <DialogDescription>
            Saisissez les informations de l'écriture. Le total des débits doit égaler le total des crédits.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 overflow-auto">
          <form id="journal-form" onSubmit={handleSubmit} className="space-y-4 pr-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Référence</Label>
                <Input
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Auto-générée si vide"
                />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description de l'écriture"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lignes de l'écriture</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter une ligne
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Compte</TableHead>
                    <TableHead>Débit</TableHead>
                    <TableHead>Crédit</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select value={line.account_id} onValueChange={(v) => updateLine(index, 'account_id', v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un compte" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.code} - {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.debit || ''}
                          onChange={(e) => updateLine(index, 'debit', e.target.value)}
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.credit || ''}
                          onChange={(e) => updateLine(index, 'credit', e.target.value)}
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(index)}
                          disabled={lines.length <= 2}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell>Total</TableCell>
                    <TableCell>{totals.totalDebit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>{totals.totalCredit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      {totals.balanced ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <div className="flex justify-end">
                <Badge variant={totals.balanced ? 'default' : 'destructive'}>
                  {totals.balanced ? 'Équilibré' : `Écart: ${Math.abs(totals.totalDebit - totals.totalCredit).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`}
                </Badge>
              </div>
            </div>
          </form>
        </ScrollArea>
        <DialogFooter className="flex-shrink-0 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="journal-form" disabled={loading || !totals.balanced}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
