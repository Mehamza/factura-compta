import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; className: string }> = {
  // Devis
  draft: { label: 'Brouillon', className: 'bg-muted text-muted-foreground' },
  sent: { label: 'Envoyé', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  accepted: { label: 'Accepté', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  rejected: { label: 'Refusé', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  expired: { label: 'Expiré', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  
  // Bon de commande
  confirmed: { label: 'Confirmé', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  
  // Bon de livraison
  delivered: { label: 'Livré', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  
  // Paiement (payment_status)
  unpaid: { label: 'Non payée', className: 'bg-muted text-muted-foreground' },
  partial: { label: 'Paiement partiel', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  paid: { label: 'Payée', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  overdue: { label: 'Échue', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },

  // Cycle (documents)
  validated: { label: 'Validée', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  
  // Annulé
  cancelled: { label: 'Annulé', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  
  // Achat
  purchase_quote: { label: "Devis d'achat", className: 'bg-muted text-muted-foreground' },
};

interface StatusBadgeProps {
  status: string;
  paymentStatus?: string | null;
  usePaymentStatus?: boolean;
  className?: string;
}

export function StatusBadge({ status, paymentStatus, usePaymentStatus, className }: StatusBadgeProps) {
  const key = usePaymentStatus ? (paymentStatus || 'unpaid') : status;
  const config = statusConfig[key] || { label: key, className: 'bg-muted text-muted-foreground' };
  
  return (
    <Badge variant="secondary" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
