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
  notes?: string;
  currency: string;
  template_type: string;
  client?: {
    name: string;
    address?: string;
    city?: string;
    postal_code?: string;
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

// Fonction utilitaire pour dessiner le cachet et signature
function drawStampZone(doc: jsPDF, y: number, pageWidth: number): number {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Cachet & Signature', pageWidth - 70, y);
  
  // Rectangle pour le cachet
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);
  doc.rect(pageWidth - 90, y + 5, 70, 35);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text('Cachet de l\'entreprise', pageWidth - 55, y + 25, { align: 'center' });
  
  return y + 45;
}

// Template Classique
export function generateClassicPDF(invoice: InvoiceTemplateData, items: InvoiceItem[]): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const currency = currencies[invoice.currency] || currencies.TND;
  
  let y = 20;
  
  // En-tête société
  if (invoice.company) {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.company.name || 'Votre Société', 20, y);
    y += 8;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (invoice.company.address) { doc.text(invoice.company.address, 20, y); y += 5; }
    if (invoice.company.postal_code || invoice.company.city) {
      doc.text(`${invoice.company.postal_code || ''} ${invoice.company.city || ''}`.trim(), 20, y);
      y += 5;
    }
    if (invoice.company.country) { doc.text(invoice.company.country, 20, y); y += 5; }
    if (invoice.company.phone) { doc.text(`Tél: ${invoice.company.phone}`, 20, y); y += 5; }
    if (invoice.company.email) { doc.text(`Email: ${invoice.company.email}`, 20, y); y += 5; }
    if (invoice.company.tax_id) { doc.text(`Matricule fiscal: ${invoice.company.tax_id}`, 20, y); y += 5; }
    if (invoice.company.trade_register) { doc.text(`RC: ${invoice.company.trade_register}`, 20, y); y += 5; }
  }
  
  // Titre FACTURE
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURE', pageWidth - 20, 30, { align: 'right' });
  
  doc.setFontSize(11);
  doc.text(`N° ${invoice.invoice_number}`, pageWidth - 20, 40, { align: 'right' });
  
  // Dates
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date d'émission: ${new Date(invoice.issue_date).toLocaleDateString('fr-FR')}`, pageWidth - 20, 50, { align: 'right' });
  doc.text(`Date d'échéance: ${new Date(invoice.due_date).toLocaleDateString('fr-FR')}`, pageWidth - 20, 56, { align: 'right' });
  
  y = Math.max(y, 65) + 10;
  
  // Encadré client
  if (invoice.client) {
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(pageWidth - 100, y - 5, 80, 45, 2, 2, 'FD');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURER À:', pageWidth - 95, y + 3);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let clientY = y + 12;
    doc.text(invoice.client.name, pageWidth - 95, clientY);
    if (invoice.client.address) { clientY += 5; doc.text(invoice.client.address, pageWidth - 95, clientY); }
    if (invoice.client.postal_code || invoice.client.city) {
      clientY += 5;
      doc.text(`${invoice.client.postal_code || ''} ${invoice.client.city || ''}`.trim(), pageWidth - 95, clientY);
    }
    if (invoice.client.siret) { clientY += 5; doc.text(`MF: ${invoice.client.siret}`, pageWidth - 95, clientY); }
  }
  
  y += 55;
  
  // Tableau des articles
  const tableTop = y;
  doc.setFillColor(50, 50, 50);
  doc.rect(20, tableTop - 6, pageWidth - 40, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Description', 25, tableTop);
  doc.text('Qté', 115, tableTop);
  doc.text('Prix unit.', 135, tableTop);
  doc.text('Total', 170, tableTop);
  
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  y = tableTop + 10;
  
  items.forEach((item, index) => {
    if (index % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(20, y - 5, pageWidth - 40, 8, 'F');
    }
    doc.text(item.description.substring(0, 40), 25, y);
    doc.text(item.quantity.toString(), 115, y);
    doc.text(formatCurrency(item.unit_price, invoice.currency), 135, y);
    doc.text(formatCurrency(item.total, invoice.currency), 170, y);
    y += 8;
  });
  
  // Ligne de séparation
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y + 2, pageWidth - 20, y + 2);
  
  // Totaux
  y += 12;
  doc.setFontSize(10);
  doc.text('Sous-total HT:', 130, y);
  doc.text(formatCurrency(invoice.subtotal, invoice.currency), 170, y);
  y += 7;
  doc.text(`TVA (${invoice.tax_rate}%):`, 130, y);
  doc.text(formatCurrency(invoice.tax_amount, invoice.currency), 170, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total TTC:', 130, y);
  doc.text(formatCurrency(invoice.total, invoice.currency), 170, y);
  
  // Montant en lettres
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
  
  // Zone cachet et signature
  y = Math.max(y + 20, 230);
  drawStampZone(doc, y, pageWidth);
  
  // Utilisateur émetteur
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
  }
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('Document généré automatiquement', pageWidth / 2, 285, { align: 'center' });
  
  doc.save(`facture-${invoice.invoice_number}.pdf`);
}

// Template Moderne
export function generateModernPDF(invoice: InvoiceTemplateData, items: InvoiceItem[]): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Bande de couleur en haut
  doc.setFillColor(41, 98, 255);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  // Titre
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURE', 20, 28);
  
  doc.setFontSize(12);
  doc.text(`N° ${invoice.invoice_number}`, pageWidth - 20, 20, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${new Date(invoice.issue_date).toLocaleDateString('fr-FR')}`, pageWidth - 20, 30, { align: 'right' });
  
  let y = 55;
  doc.setTextColor(0, 0, 0);
  
  // Deux colonnes: Société et Client
  // Société
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 98, 255);
  doc.text('DE', 20, y);
  doc.setTextColor(0, 0, 0);
  y += 8;
  
  if (invoice.company) {
    doc.setFontSize(11);
    doc.text(invoice.company.name || '', 20, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (invoice.company.address) { doc.text(invoice.company.address, 20, y); y += 5; }
    if (invoice.company.city) { doc.text(`${invoice.company.postal_code || ''} ${invoice.company.city}`, 20, y); y += 5; }
    if (invoice.company.phone) { doc.text(invoice.company.phone, 20, y); y += 5; }
    if (invoice.company.email) { doc.text(invoice.company.email, 20, y); y += 5; }
    if (invoice.company.tax_id) { doc.text(`MF: ${invoice.company.tax_id}`, 20, y); y += 5; }
  }
  
  // Client
  let clientY = 55;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 98, 255);
  doc.text('À', pageWidth - 90, clientY);
  doc.setTextColor(0, 0, 0);
  clientY += 8;
  
  if (invoice.client) {
    doc.setFontSize(11);
    doc.text(invoice.client.name, pageWidth - 90, clientY);
    clientY += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (invoice.client.address) { doc.text(invoice.client.address, pageWidth - 90, clientY); clientY += 5; }
    if (invoice.client.city) { doc.text(`${invoice.client.postal_code || ''} ${invoice.client.city}`, pageWidth - 90, clientY); clientY += 5; }
    if (invoice.client.email) { doc.text(invoice.client.email, pageWidth - 90, clientY); clientY += 5; }
    if (invoice.client.siret) { doc.text(`MF: ${invoice.client.siret}`, pageWidth - 90, clientY); }
  }
  
  // Dates
  y = Math.max(y, clientY) + 15;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(20, y - 5, pageWidth - 40, 20, 3, 3, 'F');
  doc.setFontSize(9);
  doc.text(`Date d'émission: ${new Date(invoice.issue_date).toLocaleDateString('fr-FR')}`, 30, y + 5);
  doc.text(`Échéance: ${new Date(invoice.due_date).toLocaleDateString('fr-FR')}`, pageWidth / 2, y + 5);
  
  y += 25;
  
  // Tableau
  doc.setFillColor(41, 98, 255);
  doc.rect(20, y, pageWidth - 40, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Description', 25, y + 7);
  doc.text('Qté', 115, y + 7);
  doc.text('Prix unit.', 135, y + 7);
  doc.text('Total', 170, y + 7);
  
  y += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  
  items.forEach(item => {
    doc.text(item.description.substring(0, 40), 25, y);
    doc.text(item.quantity.toString(), 117, y);
    doc.text(formatCurrency(item.unit_price, invoice.currency), 135, y);
    doc.text(formatCurrency(item.total, invoice.currency), 170, y);
    y += 8;
  });
  
  // Totaux avec fond coloré
  y += 5;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(120, y - 3, 70, 35, 3, 3, 'F');
  
  doc.setFontSize(10);
  doc.text('Sous-total HT:', 125, y + 5);
  doc.text(formatCurrency(invoice.subtotal, invoice.currency), 185, y + 5, { align: 'right' });
  doc.text(`TVA (${invoice.tax_rate}%):`, 125, y + 13);
  doc.text(formatCurrency(invoice.tax_amount, invoice.currency), 185, y + 13, { align: 'right' });
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(41, 98, 255);
  doc.text('TOTAL TTC:', 125, y + 25);
  doc.text(formatCurrency(invoice.total, invoice.currency), 185, y + 25, { align: 'right' });
  
  // Montant en lettres
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
  
  // Zone cachet
  y = Math.max(y + 20, 220);
  drawStampZone(doc, y, pageWidth);
  
  // Utilisateur
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
  }
  
  // Footer avec ligne colorée
  doc.setFillColor(41, 98, 255);
  doc.rect(0, 287, pageWidth, 3, 'F');
  
  doc.save(`facture-${invoice.invoice_number}.pdf`);
}

// Template Minimaliste
export function generateMinimalPDF(invoice: InvoiceTemplateData, items: InvoiceItem[]): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  let y = 25;
  
  // En-tête simple
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('FACTURE', 20, y);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.invoice_number, 20, y + 10);
  
  // Dates à droite
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Émise le', pageWidth - 20, y, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  doc.text(new Date(invoice.issue_date).toLocaleDateString('fr-FR'), pageWidth - 20, y + 6, { align: 'right' });
  doc.setTextColor(120, 120, 120);
  doc.text('Échéance', pageWidth - 20, y + 14, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  doc.text(new Date(invoice.due_date).toLocaleDateString('fr-FR'), pageWidth - 20, y + 20, { align: 'right' });
  
  y = 55;
  
  // Ligne de séparation fine
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);
  
  y += 15;
  
  // De / À
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('DE', 20, y);
  doc.text('À', pageWidth / 2 + 10, y);
  
  y += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  
  // Société
  if (invoice.company) {
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.company.name || '', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let compY = y + 6;
    if (invoice.company.address) { doc.text(invoice.company.address, 20, compY); compY += 5; }
    if (invoice.company.city) { doc.text(`${invoice.company.postal_code || ''} ${invoice.company.city}`, 20, compY); compY += 5; }
    if (invoice.company.tax_id) { doc.text(`MF: ${invoice.company.tax_id}`, 20, compY); }
  }
  
  // Client
  if (invoice.client) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.client.name, pageWidth / 2 + 10, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let cliY = y + 6;
    if (invoice.client.address) { doc.text(invoice.client.address, pageWidth / 2 + 10, cliY); cliY += 5; }
    if (invoice.client.city) { doc.text(`${invoice.client.postal_code || ''} ${invoice.client.city}`, pageWidth / 2 + 10, cliY); cliY += 5; }
    if (invoice.client.siret) { doc.text(`MF: ${invoice.client.siret}`, pageWidth / 2 + 10, cliY); }
  }
  
  y += 35;
  
  // Ligne
  doc.setDrawColor(230, 230, 230);
  doc.line(20, y, pageWidth - 20, y);
  
  y += 10;
  
  // En-tête tableau simple
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('DESCRIPTION', 20, y);
  doc.text('QTÉ', 115, y);
  doc.text('PRIX', 140, y);
  doc.text('TOTAL', pageWidth - 20, y, { align: 'right' });
  
  y += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  
  items.forEach(item => {
    doc.text(item.description.substring(0, 45), 20, y);
    doc.text(item.quantity.toString(), 117, y);
    doc.text(formatCurrency(item.unit_price, invoice.currency), 140, y);
    doc.text(formatCurrency(item.total, invoice.currency), pageWidth - 20, y, { align: 'right' });
    y += 8;
  });
  
  y += 5;
  doc.setDrawColor(230, 230, 230);
  doc.line(120, y, pageWidth - 20, y);
  
  // Totaux alignés à droite
  y += 10;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Sous-total HT', 140, y);
  doc.setTextColor(0, 0, 0);
  doc.text(formatCurrency(invoice.subtotal, invoice.currency), pageWidth - 20, y, { align: 'right' });
  
  y += 7;
  doc.setTextColor(120, 120, 120);
  doc.text(`TVA ${invoice.tax_rate}%`, 140, y);
  doc.setTextColor(0, 0, 0);
  doc.text(formatCurrency(invoice.tax_amount, invoice.currency), pageWidth - 20, y, { align: 'right' });
  
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL TTC', 140, y);
  doc.text(formatCurrency(invoice.total, invoice.currency), pageWidth - 20, y, { align: 'right' });
  
  // Montant en lettres
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
  
  // Zone cachet
  y = Math.max(y + 25, 215);
  drawStampZone(doc, y, pageWidth);
  
  // Utilisateur
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
  }
  
  doc.save(`facture-${invoice.invoice_number}.pdf`);
}

// Fonction principale pour générer le PDF selon le template
export function generateInvoiceWithTemplate(
  invoice: InvoiceTemplateData,
  items: InvoiceItem[]
): void {
  switch (invoice.template_type) {
    case 'modern':
      generateModernPDF(invoice, items);
      break;
    case 'minimal':
      generateMinimalPDF(invoice, items);
      break;
    case 'classic':
    default:
      generateClassicPDF(invoice, items);
      break;
  }
}
