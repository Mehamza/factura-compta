import { jsPDF } from 'jspdf';
import { ClientInvoiceStatement } from './getClientInvoiceStatement';

const formatNumber = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR');

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulée',
};

export function generateClientStatementPDF(
  statement: ClientInvoiceStatement,
  clientName: string,
  dateRange?: { start?: string; end?: string }
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const checkPageBreak = (neededSpace: number) => {
    if (y + neededSpace > pageHeight - 20) {
      doc.addPage();
      y = 20;
      return true;
    }
    return false;
  };

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('RELEVÉ CLIENT', pageWidth / 2, y, { align: 'center' });
  y += 12;

  // Client info and date range
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Client : ${clientName}`, margin, y);
  if (dateRange?.start || dateRange?.end) {
    y += 6;
    doc.text(`Période : ${dateRange.start || '...'} au ${dateRange.end || '...'}`, margin, y);
  }
  y += 10;

  // Summary box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, y, contentWidth, 28, 2, 2, 'F');
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('RÉSUMÉ', margin + 5, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.text(`Total TTC : ${formatNumber(statement.summary.total_invoiced)} DT`, margin + 5, y);
  doc.text(`Total payé : ${formatNumber(statement.summary.total_paid)} DT`, margin + 70, y);
  doc.text(`Solde restant : ${formatNumber(statement.summary.total_balance)} DT`, margin + 135, y);
  y += 18;

  // Invoices with items
  statement.invoices.forEach((inv, index) => {
    // Calculate space needed for this invoice
    const itemsHeight = inv.items.length * 6 + 30; // items + header + totals
    checkPageBreak(itemsHeight + 20);

    // Invoice header
    doc.setFillColor(70, 130, 180); // Steel blue
    doc.setTextColor(255, 255, 255);
    doc.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`FACTURE ${inv.invoice_number}`, margin + 3, y + 5.5);
    doc.text(`${formatDate(inv.issue_date)}`, margin + 80, y + 5.5);
    doc.text(`Échéance: ${formatDate(inv.due_date)}`, margin + 115, y + 5.5);
    doc.text(STATUS_LABELS[inv.status] || inv.status, margin + contentWidth - 25, y + 5.5);
    y += 12;

    // Items table header
    doc.setTextColor(0, 0, 0);
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Description', margin + 3, y + 5);
    doc.text('Qté', margin + 100, y + 5);
    doc.text('P.U. (DT)', margin + 120, y + 5);
    doc.text('Total (DT)', margin + 155, y + 5);
    y += 9;

    // Items rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (inv.items.length === 0) {
      doc.setTextColor(128, 128, 128);
      doc.text('Aucun article', margin + 3, y + 4);
      doc.setTextColor(0, 0, 0);
      y += 7;
    } else {
      inv.items.forEach((item) => {
        checkPageBreak(8);
        // Truncate description if too long
        const desc = item.description.length > 45 ? item.description.substring(0, 42) + '...' : item.description;
        doc.text(desc, margin + 3, y + 4);
        doc.text(item.quantity.toString(), margin + 100, y + 4);
        doc.text(formatNumber(item.unit_price), margin + 120, y + 4);
        doc.text(formatNumber(item.total), margin + 155, y + 4);
        y += 6;
      });
    }

    // Invoice totals
    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin + 90, y, margin + contentWidth, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total HT: ${formatNumber(inv.total_ht)} DT`, margin + 100, y);
    doc.text(`TVA: ${formatNumber(inv.total_tva)} DT`, margin + 140, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total TTC: ${formatNumber(inv.total_ttc)} DT`, margin + 100, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(inv.balance > 0 ? 180 : 0, inv.balance > 0 ? 0 : 128, 0);
    doc.text(`Payé: ${formatNumber(inv.paid)} DT  |  Solde: ${formatNumber(inv.balance)} DT`, margin + 100, y);
    doc.setTextColor(0, 0, 0);
    y += 12;

    // Separator between invoices
    if (index < statement.invoices.length - 1) {
      doc.setDrawColor(220, 220, 220);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(margin, y, margin + contentWidth, y);
      doc.setLineDashPattern([], 0);
      y += 8;
    }
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

  doc.save(`releve-client-${clientName.replace(/\s+/g, '_')}.pdf`);
}
