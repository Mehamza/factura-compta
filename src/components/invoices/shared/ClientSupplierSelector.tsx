import { AutoFillInput } from '@/components/shared/AutoFillInput';
import type { Client, Supplier } from './types';

interface ClientSupplierSelectorProps {
  type: 'client' | 'supplier';
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ClientSupplierSelector({ type, value, onChange, disabled }: ClientSupplierSelectorProps) {
  return (
    <AutoFillInput<Client | Supplier>
      entity={type}
      mode="combobox"
      selectedId={value}
      disabled={disabled}
      onSelect={(item) => onChange(item.id)}
    />
  );
}
