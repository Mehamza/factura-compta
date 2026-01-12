import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ProductRefAutocomplete } from './ProductRefAutocomplete';
import type { InvoiceItem, Product } from './types';

interface InvoiceItemRowProps {
  item: InvoiceItem;
  index: number;
  productId?: string;
  maxQuantity?: number;
  priceType: 'sale' | 'purchase';
  defaultVatRate: number;
  onProductSelect: (index: number, product: Product) => void;
  onReferenceChange: (index: number, text: string) => void;
  onUpdate: (index: number, field: keyof InvoiceItem, value: string | number | boolean) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

export function InvoiceItemRow({
  item,
  index,
  productId,
  maxQuantity,
  priceType,
  defaultVatRate,
  onProductSelect,
  onReferenceChange,
  onUpdate,
  onRemove,
  canRemove,
}: InvoiceItemRowProps) {
  const handleProductChange = (product: Product) => {
    onProductSelect(index, product);
  };

  return (
    <div className="grid grid-cols-12 gap-2 items-start p-3 border rounded-lg bg-card">
      {/* Product / Ref (autocomplete + manual typing) */}
      <div className="col-span-12 md:col-span-3">
        <ProductRefAutocomplete
          value={item.reference}
          selectedProductId={productId}
          onChangeText={(text) => onReferenceChange(index, text)}
          onSelectProduct={handleProductChange}
          priceType={priceType}
        />
      </div>

      {/* Description */}
      <div className="col-span-12 md:col-span-3">
        <Input
          placeholder="Description"
          value={item.description}
          onChange={(e) => onUpdate(index, 'description', e.target.value)}
        />
      </div>

      {/* Quantity */}
      <div className="col-span-4 md:col-span-1">
        <Input
          type="number"
          min={priceType === 'sale' ? 0 : 1}
          max={typeof maxQuantity === 'number' ? maxQuantity : undefined}
          step="1"
          placeholder="Qté"
          value={item.quantity}
          onChange={(e) => onUpdate(index, 'quantity', Number(e.target.value))}
        />
      </div>

      {/* Unit Price */}
      <div className="col-span-4 md:col-span-1">
        <Input
          type="number"
          min="0"
          step="0.001"
          placeholder="P.U."
          value={item.unit_price}
          onChange={(e) => onUpdate(index, 'unit_price', Number(e.target.value))}
        />
      </div>

      {/* VAT Rate */}
      <div className="col-span-4 md:col-span-1">
        <Input
          type="number"
          min="0"
          max="100"
          step="1"
          placeholder="TVA %"
          value={item.vat_rate}
          onChange={(e) => onUpdate(index, 'vat_rate', Number(e.target.value))}
        />
      </div>

      {/* FODEC */}
      <div className="col-span-6 md:col-span-1 flex items-center gap-1">
        <Checkbox
          checked={item.fodec_applicable || false}
          onCheckedChange={(checked) => onUpdate(index, 'fodec_applicable', checked === true)}
        />
        <span className="text-xs text-muted-foreground">FODEC</span>
      </div>

      {/* Total */}
      <div className="col-span-5 md:col-span-1">
        <div className="h-10 flex items-center justify-end font-medium">
          {item.total.toFixed(3)}
        </div>
      </div>

      {/* Remove */}
      <div className="col-span-1 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
