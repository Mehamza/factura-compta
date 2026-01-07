import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Product } from './types';

interface ProductSelectorProps {
  value: string;
  onChange: (product: Product) => void;
  disabled?: boolean;
  priceType?: 'sale' | 'purchase';
}

export function ProductSelector({ value, onChange, disabled, priceType = 'sale' }: ProductSelectorProps) {
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

  const selected = products.find((p) => p.id === value);

  const getDisplayPrice = (product: Product) => {
    if (priceType === 'purchase') {
      return product.purchase_price ?? product.unit_price ?? 0;
    }
    return product.sale_price ?? product.unit_price ?? 0;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-left"
          disabled={disabled || loading}
        >
          <span className="truncate">{selected ? selected.name : 'Produit...'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher un produit..." />
          <CommandList>
            <CommandEmpty>Aucun produit trouvé.</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.name}
                  onSelect={() => {
                    onChange(product);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === product.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col flex-1">
                    <div className="flex justify-between">
                      <span className="font-medium">{product.name}</span>
                      <span className="text-muted-foreground">{getDisplayPrice(product).toFixed(3)} TND</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{product.sku || 'N/A'}</span>
                      <span>Stock: {product.quantity}</span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
