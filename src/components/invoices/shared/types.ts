import type { DocumentKind } from '@/config/documentTypes';

export interface InvoiceItem {
  id?: string;
  reference: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  vat_amount: number;
  fodec_applicable?: boolean;
  fodec_rate?: number;
  fodec_amount?: number;
  total: number;
}

export interface Client {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  siret: string | null;
  vat_number: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  siret: string | null;
  vat_number: string | null;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  min_stock: number;
  sale_price: number | null;
  purchase_price: number | null;
  unit_price: number;
  description: string | null;
  unit: string | null;
  vat_rate: number | null;
  fodec_applicable: boolean | null;
  fodec_rate: number | null;
}

export interface InvoiceTotals {
  subtotal: number;
  totalFodec: number;
  discountAmount: number;
  baseTVA: number;
  taxAmount: number;
  stamp: number;
  total: number;
}

export interface DiscountConfig {
  type: 'percent' | 'fixed';
  value: number;
}

export const STAMP_AMOUNT = 1; // TND

export const calculateTotals = (
  items: InvoiceItem[], 
  stampIncluded: boolean,
  discount?: DiscountConfig
): InvoiceTotals => {
  const subtotal = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const totalFodec = items.reduce((sum, item) => sum + Number(item.fodec_amount || 0), 0);
  
  // Calculate discount
  let discountAmount = 0;
  if (discount && discount.value > 0) {
    if (discount.type === 'percent') {
      discountAmount = subtotal * (discount.value / 100);
    } else {
      discountAmount = discount.value;
    }
  }
  
  const subtotalAfterDiscount = subtotal - discountAmount;
  const baseTVA = subtotalAfterDiscount + totalFodec;
  const taxAmount = items.reduce((sum, item) => {
    const itemHT = Number(item.total || 0);
    const itemFodec = Number(item.fodec_amount || 0);
    // Proportionally reduce tax based on discount
    const discountRatio = subtotal > 0 ? (subtotalAfterDiscount / subtotal) : 1;
    const adjustedHT = itemHT * discountRatio;
    return sum + ((adjustedHT + itemFodec) * (Number(item.vat_rate) / 100));
  }, 0);
  const stamp = stampIncluded ? STAMP_AMOUNT : 0;
  const total = baseTVA + taxAmount + stamp;
  return { subtotal, totalFodec, discountAmount, baseTVA, taxAmount, stamp, total };
};
