import { jsPDF } from 'jspdf';
import { ClientInvoiceStatement } from './getClientInvoiceStatement';

export function generateClientStatementPDF(
  statement: ClientInvoiceStatement,
  clientName: string,
  dateRange?: { start?: string; end?: string }
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Relevé Client', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Client name and date range
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Client : ${clientName}`, 20, y);
  if (dateRange?.start || dateRange?.end) {
    y += 7;
    doc.text(
      `Période : ${dateRange.start || '...'} au ${dateRange.end || '...'}`,
      20,
      y
    );
  }
  y += 10;

  // Summary
  doc.setFont('helvetica', 'bold');
  doc.text('Résumé', 20, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Total TTC : ${statement.summary.total_invoiced.toLocaleString('fr-FR')} DT`,
    20,
    y
  );
  y += 6;
  doc.text(
    `Total payé : ${statement.summary.total_paid.toLocaleString('fr-FR')} DT`,
    20,
    y
  );
  y += 6;
  doc.text(
    `Solde restant : ${statement.summary.total_balance.toLocaleString('fr-FR')} DT`,
    20,
    y
  );
  y += 10;

  // Table header
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(20, y - 5, pageWidth - 40, 8, 'F');
  doc.text('N° Facture', 22, y);
  doc.text('Date', 50, y);
  doc.text('Échéance', 75, y);
  doc.text('Total HT', 100, y);
  doc.text('TVA', 120, y);
  doc.text('Total TTC', 140, y);
  doc.text('Payé', 160, y);
  doc.text('Solde', 180, y);
  doc.text('Statut', 200, y);
  y += 7;

  // Table rows
  doc.setFont('helvetica', 'normal');
  statement.invoices.forEach(inv => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(inv.invoice_number, 22, y);
    doc.text(new Date(inv.issue_date).toLocaleDateString('fr-FR'), 50, y);
    doc.text(new Date(inv.due_date).toLocaleDateString('fr-FR'), 75, y);
    doc.text(`${inv.total_ht.toLocaleString('fr-FR')} DT`, 100, y);
    doc.text(`${inv.total_tva.toLocaleString('fr-FR')} DT`, 120, y);
    doc.text(`${inv.total_ttc.toLocaleString('fr-FR')} DT`, 140, y);
    doc.text(`${inv.paid.toLocaleString('fr-FR')} DT`, 160, y);
    doc.text(`${inv.balance.toLocaleString('fr-FR')} DT`, 180, y);
    doc.text(inv.status, 200, y);
    y += 7;
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('Document généré automatiquement', pageWidth / 2, 290, { align: 'center' });

  doc.save(`releve-client-${clientName.replace(/\s+/g, '_')}.pdf`);
}
