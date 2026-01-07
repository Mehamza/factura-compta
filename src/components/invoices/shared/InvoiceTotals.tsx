import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { InvoiceTotals as TotalsType } from './types';

interface InvoiceTotalsProps {
  totals: TotalsType;
  stampIncluded: boolean;
  onStampChange: (checked: boolean) => void;
  currency?: string;
  showStamp?: boolean;
}

export function InvoiceTotals({ 
  totals, 
  stampIncluded, 
  onStampChange, 
  currency = 'TND',
  showStamp = true 
}: InvoiceTotalsProps) {
  const formatAmount = (amount: number) => {
    return `${amount.toFixed(3)} ${currency}`;
  };

  return (
    <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Sous-total HT</span>
        <span className="font-medium">{formatAmount(totals.subtotal)}</span>
      </div>
      
      {totals.totalFodec > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total FODEC</span>
          <span className="font-medium">{formatAmount(totals.totalFodec)}</span>
        </div>
      )}
      
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Base TVA</span>
        <span className="font-medium">{formatAmount(totals.baseTVA)}</span>
      </div>
      
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Total TVA</span>
        <span className="font-medium">{formatAmount(totals.taxAmount)}</span>
      </div>
      
      {showStamp && (
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2">
            <Checkbox 
              id="stamp" 
              checked={stampIncluded} 
              onCheckedChange={(checked) => onStampChange(checked === true)}
            />
            <Label htmlFor="stamp" className="text-muted-foreground cursor-pointer">
              Timbre fiscal
            </Label>
          </div>
          <span className="font-medium">{formatAmount(totals.stamp)}</span>
        </div>
      )}
      
      <div className="border-t pt-3 flex justify-between">
        <span className="font-semibold">Total TTC</span>
        <span className="font-bold text-lg">{formatAmount(totals.total)}</span>
      </div>
    </div>
  );
}
