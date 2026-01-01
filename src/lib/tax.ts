export interface LineInput {
  quantity: number;
  unit_price: number;
  vat_rate_percent: number; // e.g., 19
  fodec_applicable: boolean;
  fodec_rate_decimal: number; // e.g., 0.01
}

export interface LineOutput {
  ht: number;
  fodec_amount: number;
  vat_amount: number;
  total_line_ttc: number;
}

export function computeLine(input: LineInput): LineOutput {
  const ht = Number(input.quantity) * Number(input.unit_price);
  const fodec = input.fodec_applicable ? ht * Number(input.fodec_rate_decimal) : 0;
  const vat = (ht + fodec) * (Number(input.vat_rate_percent) / 100);
  const total_ttc = ht + fodec + vat;
  return { ht, fodec_amount: fodec, vat_amount: vat, total_line_ttc: total_ttc };
}

export function computeTotals(lines: LineOutput[], stampIncluded: boolean, stampAmount = 1) {
  const subtotal = lines.reduce((s, l) => s + l.ht, 0);
  const totalFodec = lines.reduce((s, l) => s + l.fodec_amount, 0);
  const taxAmount = lines.reduce((s, l) => s + l.vat_amount, 0);
  const baseTVA = subtotal + totalFodec;
  const stamp = stampIncluded ? stampAmount : 0;
  const total = baseTVA + taxAmount + stamp;
  return { subtotal, totalFodec, baseTVA, taxAmount, stamp, total };
}
