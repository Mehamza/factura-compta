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
    id?: string;
    name: string;
    address?: string;
    city?: string;
    postal_code?: string;
    phone?: string;
    email?: string;
    siret?: string;
    vat_number?: string;
  };
  company?: {
    name?: string;
    address?: string;
    city?: string;
    postal_code?: string;
    phone?: string;
    email?: string;
    tax_id?: string;
    trade_register?: string;
    activity?: string;
  };
}

export function generateInvoicePDF(invoice: Invoice, items: InvoiceItem[]): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  let y = 15;
  
  // Title (top right) then date under title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('FACTURE', pageWidth - 20, y, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const currentDate = new Date().toLocaleDateString('fr-FR');
  doc.text(`Le ${currentDate}`, pageWidth - 20, y + 7, { align: 'right' });

  y = 20;
  
  // Company info on left
  if (invoice.company) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.company.name || 'Votre Société', 20, y);
    y += 6;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    if (invoice.company.activity) {
      doc.text(invoice.company.activity, 20, y);
      y += 5;
    }
    if (invoice.company.address) {
      doc.text(invoice.company.address, 20, y);
      y += 5;
    }
    if (invoice.company.postal_code || invoice.company.city) {
      doc.text(`${invoice.company.postal_code || ''} ${invoice.company.city || ''}`.trim(), 20, y);
      y += 5;
    }
    if (invoice.company.phone) {
      doc.text(`GSM: ${invoice.company.phone}`, 20, y);
      y += 5;
    }
    if (invoice.company.tax_id) {
      doc.text(`M.F: ${invoice.company.tax_id}`, 20, y);
      y += 5;
    }
    if (invoice.company.trade_register) {
      doc.text(`RC: ${invoice.company.trade_register}`, 20, y);
      y += 5;
    }
  }
  
  y = Math.max(y + 10, 55);
  
  // Invoice info box
  const boxX = 20;
  const boxWidth = pageWidth - 40;
  
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(boxX, y, boxWidth, 20);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('N° Facture:', boxX + 3, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoice_number, boxX + 30, y + 7);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Date d\'émission:', boxX + 70, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(invoice.issue_date).toLocaleDateString('fr-FR'), boxX + 105, y + 7);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Date d\'échéance:', boxX + 3, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(invoice.due_date).toLocaleDateString('fr-FR'), boxX + 38, y + 14);
  
  y += 30;
  
  // Client info box
  if (invoice.client) {
    const rowHeight = 7;
    
    // Row 1: Code Client
    doc.rect(boxX, y, boxWidth, rowHeight);
    doc.setFont('helvetica', 'bold');
    doc.text('Code Client:', boxX + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    const clientCode = invoice.client.id ? invoice.client.id.substring(0, 8).toUpperCase() : 'N/A';
    doc.text(clientCode, boxX + 35, y + 5);
    
    // Row 2: Client name
    y += rowHeight;
    doc.rect(boxX, y, boxWidth, rowHeight);
    doc.setFont('helvetica', 'bold');
    doc.text('Client:', boxX + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.client.name, boxX + 35, y + 5);
    
    // Row 3: M.Fiscal
    y += rowHeight;
    doc.rect(boxX, y, boxWidth, rowHeight);
    doc.setFont('helvetica', 'bold');
    doc.text('M.Fiscal:', boxX + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.client.vat_number || invoice.client.siret || '', boxX + 35, y + 5);
    
    // Row 4: Address
    y += rowHeight;
    doc.rect(boxX, y, boxWidth, rowHeight);
    doc.setFont('helvetica', 'bold');
    doc.text('Adresse:', boxX + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    const fullAddress = [invoice.client.address, invoice.client.postal_code, invoice.client.city].filter(Boolean).join(', ');
    doc.text(fullAddress || '', boxX + 35, y + 5);
    
    // Row 5: Phone
    y += rowHeight;
    doc.rect(boxX, y, boxWidth, rowHeight);
    doc.setFont('helvetica', 'bold');
    doc.text('Téléphone:', boxX + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.client.phone || '', boxX + 35, y + 5);
    
    // Row 6: Email
    y += rowHeight;
    doc.rect(boxX, y, boxWidth, rowHeight);
    doc.setFont('helvetica', 'bold');
    doc.text('Email:', boxX + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.client.email || '', boxX + 35, y + 5);
    
    y += rowHeight + 10;
  }
  
  // Table header
  const tableTop = y;
  doc.setFillColor(240, 240, 240);
  doc.rect(20, tableTop, pageWidth - 40, 8, 'F');
  doc.setDrawColor(0, 0, 0);
  doc.rect(20, tableTop, pageWidth - 40, 8);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('REF', 25, tableTop + 5.5);
  doc.text('DESIGNATION', 45, tableTop + 5.5);
  doc.text('QTE', 120, tableTop + 5.5);
  doc.text('P.U.T.C', 140, tableTop + 5.5);
  doc.text('TOTAL', 170, tableTop + 5.5);
  
  y = tableTop + 8;
  doc.setFont('helvetica', 'normal');
  
  items.forEach((item, index) => {
    doc.setDrawColor(200, 200, 200);
    doc.rect(20, y, pageWidth - 40, 8);
    
    doc.text((index + 1).toString(), 25, y + 5.5);
    doc.text(item.description.substring(0, 35), 45, y + 5.5);
    doc.text(item.quantity.toString(), 122, y + 5.5);
    doc.text(`${item.unit_price.toFixed(2)} DT`, 140, y + 5.5);
    doc.text(`${item.total.toFixed(2)} DT`, 170, y + 5.5);
    y += 8;
  });
  
  // Totals
  y += 10;
  doc.setFontSize(10);
  doc.text('Sous-total HT:', 130, y);
  doc.text(`${invoice.subtotal.toFixed(2)} DT`, pageWidth - 25, y, { align: 'right' });
  y += 7;
  doc.text(`TVA (${invoice.tax_rate}%):`, 130, y);
  doc.text(`${invoice.tax_amount.toFixed(2)} DT`, pageWidth - 25, y, { align: 'right' });
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total TTC:', 130, y);
  doc.text(`${invoice.total.toFixed(2)} DT`, pageWidth - 25, y, { align: 'right' });
  
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
  // Page number at bottom right
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('1', pageWidth - 20, pageHeight - 10, { align: 'right' });
  
  // Company info centered at bottom
  if (invoice.company) {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const footerParts = [];
    if (invoice.company.name) footerParts.push(invoice.company.name);
    if (invoice.company.address) footerParts.push(invoice.company.address);
    if (invoice.company.email) footerParts.push(invoice.company.email);
    
    const footerText = footerParts.join(' - ');
    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }
  
  doc.save(`facture-${invoice.invoice_number}.pdf`);
}
