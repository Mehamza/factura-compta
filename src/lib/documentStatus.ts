/**
 * Statuts des documents conformes au modèle tunisien
 * 
 * RÈGLES MÉTIER:
 * - Une facture commence en 'draft'
 * - Après validation, elle passe en 'validated'
 * - Le statut de paiement est séparé dans invoices.payment_status
 * - Seuls les brouillons peuvent être annulés → 'cancelled'
 */

export const InvoiceStatus = {
  // Statuts généraux
  DRAFT: 'draft',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  CONFIRMED: 'confirmed',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  
  // Statut de cycle pour facture
  VALIDATED: 'validated',   // Facture émise
  
  // Statut legacy (à supprimer après migration complète)
  PURCHASE_QUOTE: 'purchase_quote',
} as const;

export type InvoiceStatus = typeof InvoiceStatus[keyof typeof InvoiceStatus];

export const InvoicePaymentStatus = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
  OVERDUE: 'overdue',
} as const;

export type InvoicePaymentStatus = typeof InvoicePaymentStatus[keyof typeof InvoicePaymentStatus];

/**
 * Statuts considérés comme "brouillon" (modifiables)
 */
export const isDraftStatus = (s: string | undefined): boolean => {
  return s === InvoiceStatus.DRAFT || s === InvoiceStatus.PURCHASE_QUOTE;
};

/**
 * Statuts considérés comme "payables" (peuvent recevoir des paiements)
 */
export const isPayableStatus = (s: string | undefined): boolean => {
  return s === InvoiceStatus.VALIDATED || s === InvoiceStatus.SENT;
};

/**
 * Vérifie si le document peut encore être modifié
 */
export const isEditable = (s: string | undefined): boolean => {
  return s === InvoiceStatus.DRAFT;
};

/**
 * Vérifie si le document est finalisé (ne peut plus être modifié)
 */
export const isFinalized = (
  status: string | undefined,
  paymentStatus?: string | null
): boolean => {
  return status === InvoiceStatus.CANCELLED || paymentStatus === InvoicePaymentStatus.PAID;
};

// Alias legacy pour rétro-compatibilité
export const isQuoteLike = isDraftStatus;

/**
 * Labels français pour les statuts
 */
export const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  validated: 'Validée',
  sent: 'Envoyée',
  accepted: 'Accepté',
  rejected: 'Refusé',
  expired: 'Expiré',
  confirmed: 'Confirmé',
  delivered: 'Livrée',
  unpaid: 'Non payée',
  partial: 'Paiement partiel',
  paid: 'Payée',
  overdue: 'Échue',
  cancelled: 'Annulée',
  purchase_quote: 'Demande de prix',
};

/**
 * Couleurs pour les badges de statut
 */
export const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  validated: 'default',
  sent: 'default',
  accepted: 'default',
  rejected: 'destructive',
  expired: 'outline',
  confirmed: 'default',
  delivered: 'default',
  unpaid: 'secondary',
  partial: 'secondary',
  paid: 'default',
  overdue: 'destructive',
  cancelled: 'outline',
};
