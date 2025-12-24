export const InvoiceStatus = {
  DRAFT: 'draft',
  PURCHASE_QUOTE: 'purchase_quote',
  SENT: 'sent',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled'
} as const;

export type InvoiceStatus = typeof InvoiceStatus[keyof typeof InvoiceStatus];

export const isQuoteLike = (s: string | undefined) => {
  return s === InvoiceStatus.DRAFT || s === InvoiceStatus.PURCHASE_QUOTE;
};
