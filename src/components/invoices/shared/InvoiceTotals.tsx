import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Percent, DollarSign } from 'lucide-react';
import type { InvoiceTotals as TotalsType, DiscountConfig } from './types';

interface InvoiceTotalsProps {
  totals: TotalsType;
  stampIncluded: boolean;
  onStampChange: (checked: boolean) => void;
  discount?: DiscountConfig;
  onDiscountChange?: (discount: DiscountConfig) => void;
  currency?: string;
  showStamp?: boolean;
  showDiscount?: boolean;
}

export function InvoiceTotals({ 
  totals, 
  stampIncluded, 
  onStampChange,
  discount = { type: 'percent', value: 0 },
  onDiscountChange,
  currency = 'TND',
  showStamp = true,
  showDiscount = true,
}: InvoiceTotalsProps) {
  const formatAmount = (amount: number) => {
    return `${amount.toFixed(3)} ${currency}`;
  };

  const handleDiscountTypeChange = (type: 'percent' | 'fixed') => {
    onDiscountChange?.({ ...discount, type });
  };

  const handleDiscountValueChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    onDiscountChange?.({ ...discount, value: numValue });
  };

  return (
    <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Sous-total HT</span>
        <span className="font-medium">{formatAmount(totals.subtotal)}</span>
      </div>

      {/* Discount input */}
      {showDiscount && onDiscountChange && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Label className="text-muted-foreground">Remise</Label>
            <div className="flex border rounded-md overflow-hidden">
              <Button
                type="button"
                variant={discount.type === 'percent' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2 rounded-none"
                onClick={() => handleDiscountTypeChange('percent')}
              >
                <Percent className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant={discount.type === 'fixed' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2 rounded-none"
                onClick={() => handleDiscountTypeChange('fixed')}
              >
                {currency}
              </Button>
            </div>
            <Input
              type="number"
              min="0"
              step={discount.type === 'percent' ? '0.1' : '0.001'}
              max={discount.type === 'percent' ? '100' : undefined}
              value={discount.value || ''}
              onChange={(e) => handleDiscountValueChange(e.target.value)}
              className="w-20 h-7 text-right"
              placeholder="0"
            />
          </div>
          {totals.discountAmount > 0 && (
            <span className="font-medium text-destructive">-{formatAmount(totals.discountAmount)}</span>
          )}
        </div>
      )}
      
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
