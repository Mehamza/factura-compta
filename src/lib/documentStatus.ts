export const InvoiceStatus = {
  DRAFT: 'draft',
  PURCHASE_QUOTE: 'purchase_quote',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  CONFIRMED: 'confirmed',
  DELIVERED: 'delivered',
  PAID: 'paid',
  OVERDUE: 'overdue',
  PARTIAL: 'partial',
  CANCELLED: 'cancelled'
} as const;

export type InvoiceStatus = typeof InvoiceStatus[keyof typeof InvoiceStatus];

export const isQuoteLike = (s: string | undefined) => {
  return s === InvoiceStatus.DRAFT || s === InvoiceStatus.PURCHASE_QUOTE;
};
