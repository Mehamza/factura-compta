import { supabase } from '@/integrations/supabase/client';

export interface InvoiceStatementRow {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  status: string;
  paid: number;
  balance: number;
}

export interface InvoiceStatementSummary {
  total_invoiced: number;
  total_paid: number;
  total_balance: number;
}

export interface ClientInvoiceStatement {
  invoices: InvoiceStatementRow[];
  summary: InvoiceStatementSummary;
}

/**
 * Get invoice statement for a client and company, optionally filtered by date range.
 * All queries are scoped by company_id and respect RLS.
 * @param client_id string
 * @param company_id string
 * @param start_date string (YYYY-MM-DD) optional
 * @param end_date string (YYYY-MM-DD) optional
 */
export async function getClientInvoiceStatement(
  client_id: string,
  company_id: string,
  start_date?: string,
  end_date?: string
): Promise<ClientInvoiceStatement> {
  // Build filters
  let query = supabase
    .from('invoices')
    .select('id, invoice_number, issue_date, due_date, subtotal, tax_amount, total, status')
    .eq('client_id', client_id)
    .eq('company_id', company_id)
    .in('status', ['sent', 'paid', 'overdue']) // Exclude drafts/cancelled
    .order('issue_date', { ascending: false });

  if (start_date) query = query.gte('issue_date', start_date);
  if (end_date) query = query.lte('issue_date', end_date);

  const { data: invoices, error } = await query;
  if (error) throw error;

  // Get payments for these invoices
  const invoiceIds = (invoices || []).map(inv => inv.id);
  let payments: { invoice_id: string; amount: number }[] = [];
  if (invoiceIds.length > 0) {
    const { data: paymentData, error: payErr } = await supabase
      .from('payments')
      .select('invoice_id, amount')
      .in('invoice_id', invoiceIds);
    if (payErr) throw payErr;
    payments = paymentData || [];
  }

  // Aggregate per invoice
  const invoiceRows: InvoiceStatementRow[] = (invoices || []).map(inv => {
    const paid = payments.filter(p => p.invoice_id === inv.id).reduce((sum, p) => sum + Number(p.amount), 0);
    const balance = Number(inv.total) - paid;
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      total_ht: Number(inv.subtotal),
      total_tva: Number(inv.tax_amount),
      total_ttc: Number(inv.total),
      status: inv.status,
      paid,
      balance,
    };
  });

  // Compute summary
  const total_invoiced = invoiceRows.reduce((sum, r) => sum + r.total_ttc, 0);
  const total_paid = invoiceRows.reduce((sum, r) => sum + r.paid, 0);
  const total_balance = invoiceRows.reduce((sum, r) => sum + r.balance, 0);

  return {
    invoices: invoiceRows,
    summary: {
      total_invoiced,
      total_paid,
      total_balance,
    },
  };
}
