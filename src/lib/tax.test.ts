import { describe, it, expect } from 'vitest';
import { computeLine, computeTotals } from './tax';

describe('FODEC + TVA calculations', () => {
  it('product with FODEC', () => {
    const line = computeLine({ quantity: 2, unit_price: 100, vat_rate_percent: 19, fodec_applicable: true, fodec_rate_decimal: 0.01 });
    expect(line.ht).toBe(200);
    expect(line.fodec_amount).toBeCloseTo(2);
    expect(line.vat_amount).toBeCloseTo((200 + 2) * 0.19);
    expect(line.total_line_ttc).toBeCloseTo(200 + 2 + (202 * 0.19));
  });

  it('product without FODEC', () => {
    const line = computeLine({ quantity: 3, unit_price: 50, vat_rate_percent: 13, fodec_applicable: false, fodec_rate_decimal: 0.01 });
    expect(line.ht).toBe(150);
    expect(line.fodec_amount).toBe(0);
    expect(line.vat_amount).toBeCloseTo(150 * 0.13);
    expect(line.total_line_ttc).toBeCloseTo(150 + (150 * 0.13));
  });

  it('mixed invoice totals', () => {
    const l1 = computeLine({ quantity: 1, unit_price: 100, vat_rate_percent: 19, fodec_applicable: true, fodec_rate_decimal: 0.01 });
    const l2 = computeLine({ quantity: 2, unit_price: 80, vat_rate_percent: 7, fodec_applicable: false, fodec_rate_decimal: 0.01 });
    const totals = computeTotals([l1, l2], true, 1);
    expect(totals.subtotal).toBeCloseTo(l1.ht + l2.ht);
    expect(totals.totalFodec).toBeCloseTo(l1.fodec_amount + l2.fodec_amount);
    expect(totals.baseTVA).toBeCloseTo(totals.subtotal + totals.totalFodec);
    expect(totals.taxAmount).toBeCloseTo(l1.vat_amount + l2.vat_amount);
    expect(totals.total).toBeCloseTo(totals.baseTVA + totals.taxAmount + 1);
  });
});
