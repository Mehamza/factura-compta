import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvoiceItemRow } from './InvoiceItemRow';
import type { InvoiceItem, Product } from './types';

interface InvoiceItemsTableProps {
  items: InvoiceItem[];
  itemProductMap: Record<number, string>;
  manualLines: Record<number, boolean>;
  priceType: 'sale' | 'purchase';
  defaultVatRate: number;
  onProductSelect: (index: number, product: Product) => void;
  onManualEntry: (index: number) => void;
  onUpdateItem: (index: number, field: keyof InvoiceItem, value: string | number | boolean) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
}

export function InvoiceItemsTable({
  items,
  itemProductMap,
  manualLines,
  priceType,
  defaultVatRate,
  onProductSelect,
  onManualEntry,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
}: InvoiceItemsTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Articles</h3>
        <Button type="button" variant="outline" size="sm" onClick={onAddItem}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une ligne
        </Button>
      </div>

      {/* Header row - hidden on mobile */}
      <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-3">
        <div className="col-span-3">Produit / Réf.</div>
        <div className="col-span-3">Description</div>
        <div className="col-span-1">Qté</div>
        <div className="col-span-1">P.U. HT</div>
        <div className="col-span-1">TVA %</div>
        <div className="col-span-1">FODEC</div>
        <div className="col-span-1 text-right">Total HT</div>
        <div className="col-span-1"></div>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.map((item, index) => (
          <InvoiceItemRow
            key={index}
            item={item}
            index={index}
            productId={itemProductMap[index]}
            isManual={manualLines[index] || false}
            priceType={priceType}
            defaultVatRate={defaultVatRate}
            onProductSelect={onProductSelect}
            onManualEntry={onManualEntry}
            onUpdate={onUpdateItem}
            onRemove={onRemoveItem}
            canRemove={items.length > 1}
          />
        ))}
      </div>
    </div>
  );
}
