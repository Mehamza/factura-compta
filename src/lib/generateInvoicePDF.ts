import { jsPDF } from 'jspdf';

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Invoice {
  invoice_number: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes?: string;
  client?: {
    name: string;
    address?: string;
    city?: string;
    postal_code?: string;
    email?: string;
    siret?: string;
    vat_number?: string;
  };
}

export function generateInvoicePDF(invoice: Invoice, items: InvoiceItem[]): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURE', 20, 30);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`N° ${invoice.invoice_number}`, 20, 40);
  
  // Dates
  doc.setFontSize(10);
  doc.text(`Date d'émission: ${new Date(invoice.issue_date).toLocaleDateString('fr-FR')}`, pageWidth - 80, 30);
  doc.text(`Date d'échéance: ${new Date(invoice.due_date).toLocaleDateString('fr-FR')}`, pageWidth - 80, 38);
  
  // Client info
  if (invoice.client) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Client:', 20, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let y = 68;
    doc.text(invoice.client.name, 20, y);
    if (invoice.client.address) { y += 6; doc.text(invoice.client.address, 20, y); }
    if (invoice.client.postal_code || invoice.client.city) {
      y += 6;
      doc.text(`${invoice.client.postal_code || ''} ${invoice.client.city || ''}`.trim(), 20, y);
    }
    if (invoice.client.email) { y += 6; doc.text(invoice.client.email, 20, y); }
    if (invoice.client.siret) { y += 6; doc.text(`SIRET: ${invoice.client.siret}`, 20, y); }
    if (invoice.client.vat_number) { y += 6; doc.text(`TVA: ${invoice.client.vat_number}`, 20, y); }
  }
  
  // Table header
  const tableTop = 110;
  doc.setFillColor(240, 240, 240);
  doc.rect(20, tableTop - 6, pageWidth - 40, 10, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Description', 22, tableTop);
  doc.text('Qté', 120, tableTop);
  doc.text('Prix unit.', 140, tableTop);
  doc.text('Total', 170, tableTop);
  
  // Table rows
  doc.setFont('helvetica', 'normal');
  let y = tableTop + 10;
  items.forEach(item => {
    doc.text(item.description.substring(0, 40), 22, y);
    doc.text(item.quantity.toString(), 120, y);
    doc.text(`${item.unit_price.toFixed(2)} €`, 140, y);
    doc.text(`${item.total.toFixed(2)} €`, 170, y);
    y += 8;
  });
  
  // Line
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y + 2, pageWidth - 20, y + 2);
  
  // Totals
  y += 12;
  doc.text('Sous-total HT:', 130, y);
  doc.text(`${invoice.subtotal.toFixed(2)} €`, 170, y);
  y += 8;
  doc.text(`TVA (${invoice.tax_rate}%):`, 130, y);
  doc.text(`${invoice.tax_amount.toFixed(2)} €`, 170, y);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Total TTC:', 130, y);
  doc.text(`${invoice.total.toFixed(2)} €`, 170, y);
  
  // Notes
  if (invoice.notes) {
    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Notes:', 20, y);
    y += 6;
    doc.text(invoice.notes.substring(0, 200), 20, y);
  }
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('Document généré automatiquement', pageWidth / 2, 280, { align: 'center' });
  
  doc.save(`facture-${invoice.invoice_number}.pdf`);
}
