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
