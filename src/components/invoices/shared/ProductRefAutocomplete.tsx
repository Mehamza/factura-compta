import { useMemo } from 'react';
import { AutoFillInput } from '@/components/shared/AutoFillInput';
import { getDefaultAutoFillAdapter } from '@/components/shared/autoFillAdapters';
import type { Product } from './types';

interface ProductRefAutocompleteProps {
  value: string;
  selectedProductId?: string;
  onChangeText: (text: string) => void;
  onSelectProduct: (product: Product) => void;
  disabled?: boolean;
  priceType?: 'sale' | 'purchase';
}

export function ProductRefAutocomplete({
  value,
  selectedProductId,
  onChangeText,
  onSelectProduct,
  disabled,
  priceType = 'sale',
}: ProductRefAutocompleteProps) {
  const getDisplayPrice = (product: Product) => {
    if (priceType === 'purchase') {
      return product.purchase_price ?? product.unit_price ?? 0;
    }
    return product.sale_price ?? product.unit_price ?? 0;
  };

  const adapter = useMemo(() => {
    const base = getDefaultAutoFillAdapter('product') as any;
    return {
      ...base,
      getSubLabel: (p: Product) => {
        const price = getDisplayPrice(p);
        const qty = Number((p as any).quantity ?? 0);
        return `${p.sku || 'N/A'} • ${price.toFixed(3)} TND • ${qty <= 0 && priceType === 'sale' ? 'Rupture' : `Stock: ${qty}`}`;
      },
      isOptionDisabled: (p: Product) => {
        const qty = Number((p as any).quantity ?? 0);
        return priceType === 'sale' && qty <= 0;
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceType]);

  return (
    <AutoFillInput<Product>
      entity="product"
      adapter={adapter}
      mode="input"
      selectedId={selectedProductId}
      disabled={disabled}
      placeholder="Produit ou référence..."
      textValue={value}
      onTextValueChange={onChangeText}
      onSelect={(p) => onSelectProduct(p as Product)}
    />
  );
}
