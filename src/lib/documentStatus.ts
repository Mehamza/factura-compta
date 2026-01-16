/**
 * Statuts des documents conformes au modèle tunisien
 * 
 * RÈGLES MÉTIER:
 * - Une facture commence en 'draft'
 * - Après validation, elle passe en 'unpaid'
 * - Le statut de paiement est porté par invoices.status (unpaid|partial|overdue|paid)
 * - Seuls les brouillons peuvent être annulés → 'cancelled'
 */

export const InvoiceStatus = {
  DRAFT: 'draft',
  CANCELLED: 'cancelled',
  VALIDATED: 'validated',

  // Statuts de paiement (portés par invoices.status pour les factures)
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
  OVERDUE: 'overdue',
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
  return s === InvoiceStatus.DRAFT;
};

/**
 * Statuts considérés comme "payables" (peuvent recevoir des paiements)
 */
export const isPayableStatus = (s: string | undefined): boolean => {
  return s === InvoiceStatus.UNPAID || s === InvoiceStatus.PARTIAL || s === InvoiceStatus.OVERDUE;
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
  return (
    status === InvoiceStatus.CANCELLED ||
    status === InvoiceStatus.PAID ||
    paymentStatus === InvoicePaymentStatus.PAID
  );
};

// Alias legacy pour rétro-compatibilité
export const isQuoteLike = isDraftStatus;

/**
 * Labels français pour les statuts
 */
export const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  validated: 'Validée',
  unpaid: 'Non payée',
  partial: 'Paiement partiel',
  paid: 'Payée',
  overdue: 'Échue',
  cancelled: 'Annulée',
};

/**
 * Couleurs pour les badges de statut
 */
export const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  validated: 'default',
  unpaid: 'secondary',
  partial: 'secondary',
  paid: 'default',
  overdue: 'destructive',
  cancelled: 'outline',
};
