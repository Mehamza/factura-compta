import { jsPDF } from 'jspdf';
import { ClientInvoiceStatement } from './getClientInvoiceStatement';
import {
  drawProfessionalHeader,
  drawClientInfoBox,
  drawProfessionalFooter,
  drawStampZone,
  type InvoiceTemplateData,
} from './invoiceTemplates';

// Manual number formatter to avoid toLocaleString non-breaking spaces that jsPDF cannot render
const formatNumber = (n: number): string => {
  const fixed = Math.abs(n).toFixed(3);
  const [intPart, decPart] = fixed.split('.');
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const result = `${withSep},${decPart}`;
  return n < 0 ? `-${result}` : result;
};
const formatDate = (d: string) => {
  const dt = new Date(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

interface ClientInfo {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
  siret?: string | null;
  vat_number?: string | null;
}

interface CompanySettings {
  company_name?: string | null;
  company_address?: string | null;
  company_city?: string | null;
  company_postal_code?: string | null;
  company_phone?: string | null;
  company_email?: string | null;
  company_tax_id?: string | null;
  company_logo_url?: string | null;
  activity?: string | null;
  signature_url?: string | null;
  stamp_url?: string | null;
  company_trade_register?: string | null;
  bank_accounts?: { bank: string; rib: string }[];
}

// Adapt CompanySettings to the InvoiceTemplateData['company'] shape used by shared functions
function toTemplateCompany(s: CompanySettings): InvoiceTemplateData['company'] {
  return {
    name: s.company_name || '',
    address: s.company_address || '',
    city: s.company_city || '',
    postal_code: s.company_postal_code || '',
    phone: s.company_phone || '',
    email: s.company_email || '',
    tax_id: s.company_tax_id || '',
    logo_url: s.company_logo_url || '',
    activity: s.activity || '',
    signature_url: s.signature_url || '',
    stamp_url: s.stamp_url || '',
    trade_register: s.company_trade_register || '',
    bank_accounts: s.bank_accounts || [],
  };
}

// Adapt ClientInfo to the InvoiceTemplateData['client'] shape used by shared functions
function toTemplateClient(c: ClientInfo): InvoiceTemplateData['client'] {
  return {
    id: c.id,
    name: c.name,
    address: c.address || '',
    city: c.city || '',
    postal_code: c.postal_code || '',
    phone: c.phone || '',
    email: c.email || '',
    siret: c.siret || '',
    vat_number: c.vat_number || '',
  };
}

export async function generateClientStatementPDF(
  statement: ClientInvoiceStatement,
  client: ClientInfo,
  companySettings: CompanySettings,
  dateRange?: { start?: string; end?: string }
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12; // Same as invoice templates
  const contentWidth = pageWidth - margin * 2;
  let pageNum = 1;

  const company = toTemplateCompany(companySettings);
  const clientData = toTemplateClient(client);

  // Pagination constants (same as invoice templates)
  const footerReserve = 18;
  const bottomLimit = pageHeight - margin - footerReserve;

  // ==================== HEADER (shared with invoices) ====================
  const metaLines = [
    `Date: ${formatDate(new Date().toISOString())}`,
  ];
  if (dateRange?.start || dateRange?.end) {
    const periodStr = `Période: ${dateRange?.start ? formatDate(dateRange.start) : '...'} — ${dateRange?.end ? formatDate(dateRange.end) : '...'}`;
    metaLines.push(periodStr);
  }

  let y = await drawProfessionalHeader(
    doc,
    pageWidth,
    company,
    'RELEVÉ DES VENTES',
    undefined,
    metaLines,
    margin
  );

  // ==================== CLIENT INFO BOX (shared with invoices) ====================
  y = drawClientInfoBox(doc, pageWidth, y, clientData, 'client', margin);

  // ==================== PERIOD BOX ====================
  if (dateRange?.start || dateRange?.end) {
    const periodText = `Période: ${dateRange?.start ? formatDate(dateRange.start) : '...'} — ${dateRange?.end ? formatDate(dateRange.end) : '...'}`;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(periodText, margin + 3, y + 5.5);
    y += 12;
  }

  // ==================== TABLE & ITEMS ====================
  const colWidths = { ref: 25, designation: 80, qty: 20, unitPrice: 30, total: 0 };
  colWidths.total = contentWidth - colWidths.ref - colWidths.designation - colWidths.qty - colWidths.unitPrice;

  // Reusable: draw table column headers
  const drawTableHeader = () => {
    const mutedBg: [number, number, number] = [240, 240, 240];
    doc.setFillColor(...mutedBg);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    let hx = margin;

    doc.text('REF', hx + 2, y + 5.5);
    hx += colWidths.ref;
    doc.line(hx, y, hx, y + 8);

    doc.text('DESIGNATION', hx + 2, y + 5.5);
    hx += colWidths.designation;
    doc.line(hx, y, hx, y + 8);

    doc.text('QTE', hx + 2, y + 5.5);
    hx += colWidths.qty;
    doc.line(hx, y, hx, y + 8);

    doc.text('P.U.HT', hx + 2, y + 5.5);
    hx += colWidths.unitPrice;
    doc.line(hx, y, hx, y + 8);

    doc.text('TOTAL HT', hx + 2, y + 5.5);

    doc.setFont('helvetica', 'normal');
    y += 8;
  };

  const addNewPage = async () => {
    await drawProfessionalFooter(doc, pageWidth, pageHeight, pageNum, company, margin);
    doc.addPage();
    pageNum++;
    y = margin + 5;
  };

  // Draw initial table header
  drawTableHeader();

  // ==================== INVOICE DATA ROWS ====================
  let grandTotalHT = 0;
  let grandTotalTVA = 0;
  let grandTotalTTC = 0;

  for (const inv of statement.invoices) {
    // Check if we need a new page for the whole invoice block
    const itemsCount = Math.max(inv.items.length, 1);
    const neededSpace = 8 + (itemsCount * 8) + 22;
    if (y + neededSpace > bottomLimit) {
      await addNewPage();
      drawTableHeader();
    }

    // Invoice header row (darker background)
    doc.setFillColor(200, 200, 200);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.rect(margin, y, contentWidth, 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(inv.invoice_number, margin + 2, y + 5);
    doc.text(`DATE: ${formatDate(inv.issue_date)}`, margin + 55, y + 5);

    doc.setFont('helvetica', 'normal');
    y += 8;

    // Invoice items
    if (inv.items.length === 0) {
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, y, contentWidth, 8);
      doc.setTextColor(128, 128, 128);
      doc.setFontSize(8);
      doc.text('Aucun article', margin + 3, y + 5.5);
      doc.setTextColor(0, 0, 0);
      y += 8;
    } else {
      for (const item of inv.items) {
        if (y + 8 > bottomLimit) {
          await addNewPage();
          drawTableHeader();
        }

        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, y, contentWidth, 8);

        // Column separators
        let sepX = margin + colWidths.ref;
        doc.line(sepX, y, sepX, y + 8);
        sepX += colWidths.designation;
        doc.line(sepX, y, sepX, y + 8);
        sepX += colWidths.qty;
        doc.line(sepX, y, sepX, y + 8);
        sepX += colWidths.unitPrice;
        doc.line(sepX, y, sepX, y + 8);

        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        let cx = margin;

        // REF
        doc.text('', cx + 2, y + 5.5);
        cx += colWidths.ref;

        // DESIGNATION
        const desc = item.description.length > 35 ? item.description.substring(0, 32) + '...' : item.description;
        doc.text(desc, cx + 2, y + 5.5);
        cx += colWidths.designation;

        // QTE
        doc.text(item.quantity.toString(), cx + 2, y + 5.5);
        cx += colWidths.qty;

        // P.U.HT
        doc.text(formatNumber(item.unit_price), cx + 2, y + 5.5);
        cx += colWidths.unitPrice;

        // TOTAL HT
        doc.text(formatNumber(item.total), cx + 2, y + 5.5);

        y += 8;
      }
    }

    // Per-invoice totals: HT, TVA, TTC
    y += 2;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const rightX = margin + contentWidth - 5;
    doc.text(`Total HT: ${formatNumber(inv.total_ht)} DT`, rightX, y + 3, { align: 'right' });
    y += 5;
    doc.text(`TVA: ${formatNumber(inv.total_tva)} DT`, rightX, y + 3, { align: 'right' });
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total TTC: ${formatNumber(inv.total_ttc)} DT`, rightX, y + 3, { align: 'right' });

    grandTotalHT += inv.total_ht;
    grandTotalTVA += inv.total_tva;
    grandTotalTTC += inv.total_ttc;
    y += 10;

    doc.setFont('helvetica', 'normal');
  }

  // ==================== GRAND TOTAL ====================
  const totalsNeeded = 70;
  if (y + totalsNeeded > bottomLimit) {
    await addNewPage();
  }

  y += 4;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Sous-total HT:', 130, y);
  doc.text(`${formatNumber(grandTotalHT)} DT`, pageWidth - margin - 5, y, { align: 'right' });

  y += 7;
  doc.text('Montant TVA:', 130, y);
  doc.text(`${formatNumber(grandTotalTVA)} DT`, pageWidth - margin - 5, y, { align: 'right' });

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total TTC:', 130, y);
  doc.text(`${formatNumber(grandTotalTTC)} DT`, pageWidth - margin - 5, y, { align: 'right' });

  // ==================== STAMP ZONE (shared with invoices) ====================
  const stampSpace = 65;
  if (y + stampSpace > pageHeight - footerReserve) {
    await addNewPage();
  }
  y = Math.max(y + 20, pageHeight - margin - footerReserve - 60);
  await drawStampZone(doc, y, pageWidth, company?.signature_url, company?.stamp_url, margin);

  // ==================== FOOTER ON LAST PAGE ====================
  await drawProfessionalFooter(doc, pageWidth, pageHeight, pageNum, company, margin);

  doc.save(`releve-ventes-${client.name.replace(/\s+/g, '_')}.pdf`);
}
