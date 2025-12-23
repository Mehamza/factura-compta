import { jsPDF } from 'jspdf';
import { numberToWords, formatCurrency, currencies } from './numberToWords';

export interface InvoiceTemplateData {
  invoice_number: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  stamp_included?: boolean;
  stamp_amount?: number;
  notes?: string;
  currency: string;
  template_type: string;
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
    country?: string;
    phone?: string;
    email?: string;
    vat_number?: string;
    tax_id?: string;
    trade_register?: string;
    logo_url?: string;
    activity?: string;
    signature_url?: string;
    stamp_url?: string;
  };
  created_by?: {
    name?: string;
    role?: string;
    created_at?: string;
  };
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export type TemplateType = 'classic' | 'modern' | 'minimal';

export const templateLabels: Record<TemplateType, string> = {
  classic: 'Classique',
  modern: 'Moderne',
  minimal: 'Minimaliste',
};

export const templateDescriptions: Record<TemplateType, string> = {
  classic: 'Design traditionnel avec bordures et structure formelle',
  modern: 'Design contemporain avec couleurs et mise en page aérée',
  minimal: 'Design épuré et minimaliste pour une lecture claire',
};

// Common header function matching Relevé Client style
function drawProfessionalHeader(
  doc: jsPDF, 
  pageWidth: number, 
  company: InvoiceTemplateData['company'],
  title: string
): number {
  let y = 15;
  
  // Date at top right
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const currentDate = new Date().toLocaleDateString('fr-FR');
  doc.text(`Le ${currentDate}`, pageWidth - 20, y, { align: 'right' });
  
  y = 20;
  
  // Company info on left
  if (company) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(company.name || 'Votre Société', 20, y);
    y += 6;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    if (company.activity) {
      doc.text(company.activity, 20, y);
      y += 5;
    }
    if (company.address) {
      doc.text(company.address, 20, y);
      y += 5;
    }
    if (company.postal_code || company.city) {
      doc.text(`${company.postal_code || ''} ${company.city || ''}`.trim(), 20, y);
      y += 5;
    }
    if (company.phone) {
      doc.text(`GSM: ${company.phone}`, 20, y);
      y += 5;
    }
    if (company.tax_id) {
      doc.text(`M.F: ${company.tax_id}`, 20, y);
      y += 5;
    }
    if (company.trade_register) {
      doc.text(`RC: ${company.trade_register}`, 20, y);
      y += 5;
    }
  }
  
  // Title on right side
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth - 20, 30, { align: 'right' });
  
  return Math.max(y + 10, 55);
}

// Common client info box matching Relevé Client style with full details
function drawClientInfoBox(
  doc: jsPDF,
  pageWidth: number,
  y: number,
  client: InvoiceTemplateData['client']
): number {
  if (!client) return y;
  
  const boxX = 20;
  const boxWidth = pageWidth - 40;
  const rowHeight = 7;
  
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.setFontSize(9);
  
  // Row 1: Code Client
  doc.rect(boxX, y, boxWidth, rowHeight);
  doc.setFont('helvetica', 'bold');
  doc.text('Code Client:', boxX + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  const clientCode = client.id ? client.id.substring(0, 8).toUpperCase() : 'N/A';
  doc.text(clientCode, boxX + 35, y + 5);
  
  // Row 2: Client name
  y += rowHeight;
  doc.rect(boxX, y, boxWidth, rowHeight);
  doc.setFont('helvetica', 'bold');
  doc.text('Client:', boxX + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(client.name || '', boxX + 35, y + 5);
  
  // Row 3: M.Fiscal
  y += rowHeight;
  doc.rect(boxX, y, boxWidth, rowHeight);
  doc.setFont('helvetica', 'bold');
  doc.text('M.Fiscal:', boxX + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(client.vat_number || client.siret || '', boxX + 35, y + 5);
  
  // Row 4: Address
  y += rowHeight;
  doc.rect(boxX, y, boxWidth, rowHeight);
  doc.setFont('helvetica', 'bold');
  doc.text('Adresse:', boxX + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  const fullAddress = [client.address, client.postal_code, client.city].filter(Boolean).join(', ');
  doc.text(fullAddress || '', boxX + 35, y + 5);
  
  // Row 5: Phone
  y += rowHeight;
  doc.rect(boxX, y, boxWidth, rowHeight);
  doc.setFont('helvetica', 'bold');
  doc.text('Téléphone:', boxX + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(client.phone || '', boxX + 35, y + 5);
  
  // Row 6: Email
  y += rowHeight;
  doc.rect(boxX, y, boxWidth, rowHeight);
  doc.setFont('helvetica', 'bold');
  doc.text('Email:', boxX + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(client.email || '', boxX + 35, y + 5);
  
  return y + rowHeight + 10;
}

// Common invoice info box
function drawInvoiceInfoBox(
  doc: jsPDF,
  pageWidth: number,
  y: number,
  invoice: InvoiceTemplateData
): number {
  const boxX = 20;
  const boxWidth = pageWidth - 40;
  const boxHeight = 20;
  
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(boxX, y, boxWidth, boxHeight);
  
  doc.setFontSize(9);
  
  // Invoice number
  doc.setFont('helvetica', 'bold');
  doc.text('N° Facture:', boxX + 3, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoice_number, boxX + 30, y + 7);
  
  // Issue date
  doc.setFont('helvetica', 'bold');
  doc.text('Date d\'émission:', boxX + 70, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(invoice.issue_date).toLocaleDateString('fr-FR'), boxX + 105, y + 7);
  
  // Due date
  doc.setFont('helvetica', 'bold');
  doc.text('Date d\'échéance:', boxX + 3, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(invoice.due_date).toLocaleDateString('fr-FR'), boxX + 38, y + 14);
  
  return y + boxHeight + 10;
}

// Common footer matching Relevé Client style
function drawProfessionalFooter(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  pageNumber: number,
  company: InvoiceTemplateData['company']
) {
  // Page number at bottom right
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(pageNumber.toString(), pageWidth - 20, pageHeight - 10, { align: 'right' });
  
  // Company info centered at bottom
  if (company) {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const footerParts = [];
    if (company.name) footerParts.push(company.name);
    if (company.address) footerParts.push(company.address);
    if (company.email) footerParts.push(company.email);
    
    const footerText = footerParts.join(' - ');
    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }
  
  doc.setTextColor(0, 0, 0);
}

// Stamp zone function
async function drawStampZone(doc: jsPDF, y: number, pageWidth: number, signatureUrl?: string, stampUrl?: string): Promise<number> {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Cachet & Signature', pageWidth - 70, y);
  
  const boxY = y + 5;
  const boxHeight = 35;
  const boxWidth = 70;
  const boxX = pageWidth - 90;
  
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);
  doc.rect(boxX, boxY, boxWidth, boxHeight);
  
  if (stampUrl) {
    try {
      const stampImg = await loadImage(stampUrl);
      const stampSize = 30;
      doc.addImage(stampImg, 'PNG', boxX + 5, boxY + 2, stampSize, stampSize);
    } catch (e) {
      console.error('Erreur chargement cachet:', e);
    }
  }
  
  if (signatureUrl) {
    try {
      const signatureImg = await loadImage(signatureUrl);
      const sigWidth = 35;
      const sigHeight = 20;
      doc.addImage(signatureImg, 'PNG', boxX + boxWidth - sigWidth - 3, boxY + boxHeight - sigHeight - 3, sigWidth, sigHeight);
    } catch (e) {
      console.error('Erreur chargement signature:', e);
    }
  }
  
  if (!stampUrl && !signatureUrl) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('Cachet de l\'entreprise', pageWidth - 55, y + 25, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }
  
  return y + 45;
}

// Image loader function
function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Template Classique
export async function generateClassicPDF(invoice: InvoiceTemplateData, items: InvoiceItem[]): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const currency = currencies[invoice.currency] || currencies.TND;
  
  // Professional header
  let y = drawProfessionalHeader(doc, pageWidth, invoice.company, 'FACTURE');
  
  // Invoice info box
  y = drawInvoiceInfoBox(doc, pageWidth, y, invoice);
  
  // Client info box
  y = drawClientInfoBox(doc, pageWidth, y, invoice.client);
  
  // Table header
  const tableTop = y;
  doc.setFillColor(240, 240, 240);
  doc.rect(20, tableTop, pageWidth - 40, 8, 'F');
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(20, tableTop, pageWidth - 40, 8);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
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
    doc.text(formatCurrency(item.unit_price, invoice.currency), 140, y + 5.5);
    doc.text(formatCurrency(item.total, invoice.currency), 170, y + 5.5);
    y += 8;
  });
  
  // Totals section
  y += 10;
  doc.setFontSize(10);
  doc.text('Sous-total HT:', 130, y);
  doc.text(formatCurrency(invoice.subtotal, invoice.currency), pageWidth - 25, y, { align: 'right' });
  y += 7;
  doc.text(`TVA (${invoice.tax_rate}%):`, 130, y);
  doc.text(formatCurrency(invoice.tax_amount, invoice.currency), pageWidth - 25, y, { align: 'right' });
  if (invoice.stamp_included) {
    y += 7;
    doc.text('Timbre fiscal:', 130, y);
    doc.text(formatCurrency(invoice.stamp_amount || 0, invoice.currency), pageWidth - 25, y, { align: 'right' });
  }
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total TTC:', 130, y);
  doc.text(formatCurrency(invoice.total, invoice.currency), pageWidth - 25, y, { align: 'right' });
  
  // Amount in words
  y += 12;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('Arrêté la présente facture à la somme de:', 20, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(numberToWords(invoice.total, invoice.currency), 20, y);
  
  // Notes
  if (invoice.notes) {
    y += 15;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Notes:', 20, y);
    y += 5;
    doc.text(invoice.notes.substring(0, 200), 20, y);
  }
  
  // Stamp zone
  y = Math.max(y + 20, 220);
  await drawStampZone(doc, y, pageWidth, invoice.company?.signature_url, invoice.company?.stamp_url);
  
  // Created by info
  if (invoice.created_by) {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    let infoY = y;
    doc.text('Émis par:', 20, infoY);
    infoY += 4;
    if (invoice.created_by.name) doc.text(invoice.created_by.name, 20, infoY);
    if (invoice.created_by.role) { infoY += 4; doc.text(`Rôle: ${invoice.created_by.role}`, 20, infoY); }
    if (invoice.created_by.created_at) {
      infoY += 4;
      doc.text(`Le: ${new Date(invoice.created_by.created_at).toLocaleString('fr-FR')}`, 20, infoY);
    }
    doc.setTextColor(0, 0, 0);
  }
  
  // Professional footer
  drawProfessionalFooter(doc, pageWidth, pageHeight, 1, invoice.company);
  
  doc.save(`facture-${invoice.invoice_number}.pdf`);
}

// Template Moderne
export async function generateModernPDF(invoice: InvoiceTemplateData, items: InvoiceItem[]): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Professional header
  let y = drawProfessionalHeader(doc, pageWidth, invoice.company, 'FACTURE');
  
  // Invoice info box
  y = drawInvoiceInfoBox(doc, pageWidth, y, invoice);
  
  // Client info box
  y = drawClientInfoBox(doc, pageWidth, y, invoice.client);
  
  // Table with blue header
  doc.setFillColor(41, 98, 255);
  doc.rect(20, y, pageWidth - 40, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('REF', 25, y + 5.5);
  doc.text('DESIGNATION', 45, y + 5.5);
  doc.text('QTE', 120, y + 5.5);
  doc.text('P.U.T.C', 140, y + 5.5);
  doc.text('TOTAL', 170, y + 5.5);
  
  y += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  
  items.forEach((item, index) => {
    if (index % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(20, y, pageWidth - 40, 8, 'F');
    }
    doc.text((index + 1).toString(), 25, y + 5.5);
    doc.text(item.description.substring(0, 35), 45, y + 5.5);
    doc.text(item.quantity.toString(), 122, y + 5.5);
    doc.text(formatCurrency(item.unit_price, invoice.currency), 140, y + 5.5);
    doc.text(formatCurrency(item.total, invoice.currency), 170, y + 5.5);
    y += 8;
  });
  
  // Totals with colored background
  y += 5;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(120, y - 3, 70, 35, 3, 3, 'F');
  
  doc.setFontSize(10);
  doc.text('Sous-total HT:', 125, y + 5);
  doc.text(formatCurrency(invoice.subtotal, invoice.currency), 185, y + 5, { align: 'right' });
  doc.text(`TVA (${invoice.tax_rate}%):`, 125, y + 13);
  doc.text(formatCurrency(invoice.tax_amount, invoice.currency), 185, y + 13, { align: 'right' });
  if (invoice.stamp_included) {
    doc.text('Timbre fiscal:', 125, y + 21);
    doc.text(formatCurrency(invoice.stamp_amount || 0, invoice.currency), 185, y + 21, { align: 'right' });
  }
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(41, 98, 255);
  doc.text('TOTAL TTC:', 125, y + 29);
  doc.text(formatCurrency(invoice.total, invoice.currency), 185, y + 29, { align: 'right' });
  
  // Amount in words
  y += 40;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('Montant en lettres:', 20, y);
  doc.setFont('helvetica', 'bold');
  doc.text(numberToWords(invoice.total, invoice.currency), 20, y + 6);
  
  // Notes
  if (invoice.notes) {
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.text('Notes: ' + invoice.notes.substring(0, 150), 20, y);
  }
  
  // Stamp zone
  y = Math.max(y + 20, 210);
  await drawStampZone(doc, y, pageWidth, invoice.company?.signature_url, invoice.company?.stamp_url);
  
  // Created by info
  if (invoice.created_by) {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    let infoY = y;
    doc.text('Émis par:', 20, infoY);
    if (invoice.created_by.name) { infoY += 4; doc.text(invoice.created_by.name, 20, infoY); }
    if (invoice.created_by.role) { infoY += 4; doc.text(`Rôle: ${invoice.created_by.role}`, 20, infoY); }
    if (invoice.created_by.created_at) {
      infoY += 4;
      doc.text(`Le: ${new Date(invoice.created_by.created_at).toLocaleString('fr-FR')}`, 20, infoY);
    }
    doc.setTextColor(0, 0, 0);
  }
  
  // Professional footer
  drawProfessionalFooter(doc, pageWidth, pageHeight, 1, invoice.company);
  
  doc.save(`facture-${invoice.invoice_number}.pdf`);
}

// Template Minimaliste
export async function generateMinimalPDF(invoice: InvoiceTemplateData, items: InvoiceItem[]): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Professional header
  let y = drawProfessionalHeader(doc, pageWidth, invoice.company, 'FACTURE');
  
  // Invoice info box
  y = drawInvoiceInfoBox(doc, pageWidth, y, invoice);
  
  // Client info box
  y = drawClientInfoBox(doc, pageWidth, y, invoice.client);
  
  // Simple table header
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('REF', 25, y);
  doc.text('DESCRIPTION', 45, y);
  doc.text('QTÉ', 120, y);
  doc.text('PRIX', 140, y);
  doc.text('TOTAL', pageWidth - 25, y, { align: 'right' });
  
  y += 3;
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);
  
  y += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  
  items.forEach((item, index) => {
    doc.text((index + 1).toString(), 25, y);
    doc.text(item.description.substring(0, 35), 45, y);
    doc.text(item.quantity.toString(), 122, y);
    doc.text(formatCurrency(item.unit_price, invoice.currency), 140, y);
    doc.text(formatCurrency(item.total, invoice.currency), pageWidth - 25, y, { align: 'right' });
    y += 8;
  });
  
  y += 5;
  doc.setDrawColor(230, 230, 230);
  doc.line(120, y, pageWidth - 20, y);
  
  // Totals
  y += 10;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Sous-total HT', 140, y);
  doc.setTextColor(0, 0, 0);
  doc.text(formatCurrency(invoice.subtotal, invoice.currency), pageWidth - 25, y, { align: 'right' });
  
  y += 7;
  doc.setTextColor(120, 120, 120);
  doc.text(`TVA ${invoice.tax_rate}%`, 140, y);
  doc.setTextColor(0, 0, 0);
  doc.text(formatCurrency(invoice.tax_amount, invoice.currency), pageWidth - 25, y, { align: 'right' });
  if (invoice.stamp_included) {
    y += 7;
    doc.setTextColor(120, 120, 120);
    doc.text('Timbre fiscal', 140, y);
    doc.setTextColor(0, 0, 0);
    doc.text(formatCurrency(invoice.stamp_amount || 0, invoice.currency), pageWidth - 25, y, { align: 'right' });
  }
  
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL TTC', 140, y);
  doc.text(formatCurrency(invoice.total, invoice.currency), pageWidth - 25, y, { align: 'right' });
  
  // Amount in words
  y += 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Arrêté à:', 20, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'italic');
  doc.text(numberToWords(invoice.total, invoice.currency), 20, y + 6);
  
  // Notes
  if (invoice.notes) {
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Notes:', 20, y);
    doc.setTextColor(0, 0, 0);
    doc.text(invoice.notes.substring(0, 150), 20, y + 5);
  }
  
  // Stamp zone
  y = Math.max(y + 25, 205);
  await drawStampZone(doc, y, pageWidth, invoice.company?.signature_url, invoice.company?.stamp_url);
  
  // Created by info
  if (invoice.created_by) {
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    let infoY = y;
    if (invoice.created_by.name) doc.text(`Émis par: ${invoice.created_by.name}`, 20, infoY);
    if (invoice.created_by.role) { infoY += 4; doc.text(`Rôle: ${invoice.created_by.role}`, 20, infoY); }
    if (invoice.created_by.created_at) {
      infoY += 4;
      doc.text(`Le: ${new Date(invoice.created_by.created_at).toLocaleString('fr-FR')}`, 20, infoY);
    }
    doc.setTextColor(0, 0, 0);
  }
  
  // Professional footer
  drawProfessionalFooter(doc, pageWidth, pageHeight, 1, invoice.company);
  
  doc.save(`facture-${invoice.invoice_number}.pdf`);
}

// Main function to generate PDF based on template
export async function generateInvoiceWithTemplate(
  invoice: InvoiceTemplateData,
  items: InvoiceItem[]
): Promise<void> {
  switch (invoice.template_type) {
    case 'modern':
      await generateModernPDF(invoice, items);
      break;
    case 'minimal':
      await generateMinimalPDF(invoice, items);
      break;
    case 'classic':
    default:
      await generateClassicPDF(invoice, items);
      break;
  }
}
