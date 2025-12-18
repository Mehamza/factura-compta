import { env } from '@/env';

type Row = Record<string, unknown>;

function toCSV(rows: Row[], headers?: string[]): string {
  if (!rows.length) return '';
  const cols = headers && headers.length ? headers : Object.keys(rows[0]);
  const escape = (val: unknown) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    // Wrap in quotes if contains comma, quote, or newline
    return /[",\n]/.test(str) ? `"${str}"` : str;
  };
  const headerLine = cols.join(',');
  const dataLines = rows.map(r => cols.map(c => escape(r[c])).join(','));
  return [headerLine, ...dataLines].join('\n');
}

export function downloadCSV(filename: string, rows: Row[], headers?: string[]) {
  const csv = toCSV(rows, headers);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function mapInvoicesToCSV(invoices: any[]) {
  return invoices.map((i) => ({
    numero: i.invoice_number,
    date_emission: i.issue_date,
    date_echeance: i.due_date,
    client_id: i.client_id,
    statut: i.status,
    sous_total: i.subtotal,
    tva: i.tax_amount,
    total: i.total,
    devise: i.currency || 'TND',
  }));
}

export function mapClientsToCSV(clients: any[]) {
  return clients.map((c) => ({
    id: c.id,
    nom: c.name,
    email: c.email,
    adresse: c.address,
    ville: c.city,
    code_postal: c.postal_code,
    siret: c.siret,
    tva: c.vat_number,
  }));
}

export function mapJournalToCSV(entries: any[], linesByEntry: Record<string, any[]>) {
  const rows: Row[] = [];
  for (const e of entries) {
    const lines = linesByEntry[e.id] || [];
    for (const l of lines) {
      rows.push({
        date: e.entry_date,
        reference: e.reference,
        description: e.description,
        account_id: l.account_id,
        debit: l.debit,
        credit: l.credit,
      });
    }
  }
  return rows;
}

export function mapProductsToCSV(products: any[]) {
  return products.map((p: any) => ({
    nom: p.name,
    sku: p.sku || '',
    quantite: p.quantity,
    stock_min: p.min_stock,
    prix_unitaire: p.unit_price,
    devise: p.currency || 'TND',
  }));
}

export function mapStockMovementsToCSV(movs: any[]) {
  return movs.map((m: any) => ({
    type: m.type,
    produit: m.products?.name || m.product_name || '',
    quantite: m.quantity,
    date: m.created_at,
    note: m.note || '',
  }));
}

// Server-side CSV export via Supabase Edge Function (admin-only)
export async function exportServerCSV(resource: 'invoices' | 'products' | 'stock_movements') {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Session invalide');

  const url = `${env.supabaseUrl}/functions/v1/export_data?resource=${resource}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || 'Échec export serveur');
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  const dlUrl = URL.createObjectURL(blob);
  a.href = dlUrl;
  a.download = `${resource}.csv`;
  a.click();
  URL.revokeObjectURL(dlUrl);
}
