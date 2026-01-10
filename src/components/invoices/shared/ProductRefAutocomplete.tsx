import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Product } from './types';
import { Input } from '@/components/ui/input';

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
  const { activeCompanyId } = useAuth();

  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeCompanyId) return;

    setLoading(true);
    supabase
      .from('products')
      .select('*')
      .eq('company_id', activeCompanyId)
      .order('name')
      .then(({ data, error }) => {
        if (!error && data) {
          setProducts(data as Product[]);
        }
        setLoading(false);
      });
  }, [activeCompanyId]);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return products.slice(0, 25);

    return products
      .filter((p) => {
        const name = (p.name || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        return name.includes(q) || sku.includes(q);
      })
      .slice(0, 25);
  }, [products, value]);

  const getDisplayPrice = (product: Product) => {
    if (priceType === 'purchase') {
      return product.purchase_price ?? product.unit_price ?? 0;
    }
    return product.sale_price ?? product.unit_price ?? 0;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          placeholder="Produit ou référence..."
          value={value}
          disabled={disabled || loading}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChangeText(e.target.value);
            setOpen(true);
          }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-1" align="start">
        <div className="max-h-[320px] overflow-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Aucun produit trouvé.</div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((product) => {
                const isSelected = selectedProductId === product.id;
                const price = getDisplayPrice(product);

                return (
                  <button
                    key={product.id}
                    type="button"
                    className={cn(
                      'w-full text-left rounded-md px-2 py-2 hover:bg-accent focus:bg-accent focus:outline-none',
                      isSelected && 'bg-accent'
                    )}
                    onMouseDown={(e) => {
                      // Prevent input blur from closing before click fires
                      e.preventDefault();
                    }}
                    onClick={() => {
                      onSelectProduct(product);
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <Check className={cn('mt-0.5 h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                      <div className="flex-1">
                        <div className="flex justify-between gap-3">
                          <span className="font-medium truncate">{product.name}</span>
                          <span className="text-muted-foreground tabular-nums">{price.toFixed(3)} TND</span>
                        </div>
                        <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                          <span className="truncate">{product.sku || 'N/A'}</span>
                          <span className="tabular-nums">Stock: {product.quantity}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
