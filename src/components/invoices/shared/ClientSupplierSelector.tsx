import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Client, Supplier } from './types';

interface ClientSupplierSelectorProps {
  type: 'client' | 'supplier';
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ClientSupplierSelector({ type, value, onChange, disabled }: ClientSupplierSelectorProps) {
  const { activeCompanyId } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<(Client | Supplier)[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeCompanyId) return;
    
    setLoading(true);
    const table = type === 'client' ? 'clients' : 'suppliers';
    
    supabase
      .from(table)
      .select('*')
      .eq('company_id', activeCompanyId)
      .order('name')
      .then(({ data, error }) => {
        if (!error && data) {
          setItems(data);
        }
        setLoading(false);
      });
  }, [activeCompanyId, type]);

  const selected = items.find((item) => item.id === value);
  const placeholder = type === 'client' ? 'Sélectionner un client...' : 'Sélectionner un fournisseur...';
  const emptyMessage = type === 'client' ? 'Aucun client trouvé.' : 'Aucun fournisseur trouvé.';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || loading}
        >
          {selected ? selected.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder={`Rechercher...`} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.name}
                  onSelect={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === item.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col">
                    <span>{item.name}</span>
                    {item.email && <span className="text-xs text-muted-foreground">{item.email}</span>}
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
