import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { statusLabels } from '@/lib/documentStatus';

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Brouillon', className: 'bg-muted text-muted-foreground' },
  unpaid: { label: 'Non payée', className: 'bg-muted text-muted-foreground' },
  partial: { label: 'Paiement partiel', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  paid: { label: 'Payée', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  overdue: { label: 'Échue', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },

  validated: { label: 'Validée', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  
  cancelled: { label: 'Annulée', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: statusLabels[status] || '—',
    className: 'bg-muted text-muted-foreground',
  };
  
  return (
    <Badge variant="secondary" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
