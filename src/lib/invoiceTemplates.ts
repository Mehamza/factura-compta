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
  fodec_amount_total?: number;
  base_tva?: number;
  stamp_included?: boolean;
  stamp_amount?: number;
  discount_amount?: number;
  discount_type?: 'percent' | 'fixed';
  discount_value?: number;
  notes?: string;
  currency: string;
  template_type: string;
  document_title?: string;
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
    bank_accounts?: { bank: string; rib: string }[];
  };
  created_by?: {
    name?: string;
    role?: string;
    created_at?: string;
  };
}

export interface InvoiceItem {
  reference?: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate?: number;
  vat_amount?: number;
  fodec_applicable?: boolean;
  fodec_rate?: number;
  fodec_amount?: number;
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

// Helper to extract company initials for fallback logo
function getCompanyInitials(companyName: string): string {
  if (!companyName) return 'CO';
  const words = companyName.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return companyName.substring(0, 2).toUpperCase();
}

// Map common Tunisian banks to their usual abbreviations
function getBankPrefix(bankName: string): string {
  if (!bankName) return '';
  const name = bankName.trim();
  const map: Record<string, string> = {
    "Banque de l'Habitat": 'BH',
    'Banque Nationale Agricole': 'BNA',
    'Union Internationale de Banques': 'UIB',
    'Société Tunisienne de Banque': 'STB',
    'Banque de Tunisie': 'BT',
    'Banque Internationale Arabe de Tunisie': 'BIAT',
    'Attijari Bank': 'ATTIJARI',
    'Amen Bank': 'AB',
    'Arab Tunisian Bank': 'ATB',
    'Banque Zitouna': 'BZ',
  };
  if (map[name]) return map[name];
  // Fallback: acronym from significant words
  const stopwords = new Set(['de', 'du', 'des', 'la', 'le', "l'", "d'", 'et', 'de la', 'de l\'']);
  const parts = name
    .replace(/\s+\/\s+/g, ' ')
    .split(/\s+/)
    .filter(w => !stopwords.has(w.toLowerCase()));
  const acronym = parts.map(w => w[0]?.toUpperCase() || '').join('');
  return acronym || name.substring(0, 3).toUpperCase();
}

// Draw fallback logo with initials
function drawFallbackLogo(
  doc: jsPDF,
  x: number,
  y: number,
  size: number,
  companyName: string
): void {
  const initials = getCompanyInitials(companyName || 'Company');
  const rectX = x;
  const rectY = y;
  const rectW = size;
  const rectH = size;
  // Draw rectangle background (professional blue)
  doc.setFillColor(37, 99, 235); // #2563eb
  doc.rect(rectX, rectY, rectW, rectH, 'F');

  // Draw initials in white, centered
  const centerX = rectX + rectW / 2;
  const centerY = rectY + rectH / 2;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size * 0.45);
  doc.text(initials, centerX, centerY + size * 0.15, { align: 'center' });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
}

// Draw company logo (loads image or uses fallback)
// For PDFs, preserve original aspect ratio (not circular)
async function drawCompanyLogo(
  doc: jsPDF,
  x: number,
  y: number,
  maxHeight: number,
  logoUrl: string | undefined | null,
  companyName: string
): Promise<{ width: number; height: number }> {
  if (logoUrl) {
    try {
      const logoData = await loadImage(logoUrl);
      
      // Get image dimensions to preserve aspect ratio
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = logoData;
      });
      
      const aspectRatio = img.width / img.height;
      const height = maxHeight;
      const width = height * aspectRatio;
      
      // Draw with original aspect ratio (rectangular)
      doc.addImage(logoData, 'PNG', x, y, width, height);
      return { width, height };
    } catch (e) {
      console.error('Error loading company logo, using fallback:', e);
    }
  }
  // Fallback to initials (circular)
  drawFallbackLogo(doc, x, y, maxHeight, companyName);
  return { width: maxHeight, height: maxHeight };
}

// Common header function matching Relevé Client style with logo
async function drawProfessionalHeader(
  doc: jsPDF, 
  pageWidth: number, 
  company: InvoiceTemplateData['company'],
  title: string
): Promise<number> {
  let y = 15;
  
  // Date at top right
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const currentDate = new Date().toLocaleDateString('fr-FR');
  doc.text(`Le ${currentDate}`, pageWidth - 20, y, { align: 'right' });
  
  y = 20;
  
  // Company info on left with logo
  if (company) {
    const logoMaxHeight = 18;
    const logoX = 20;
    const logoY = y - 3;
    
    // Draw logo and get actual width
    const logoResult = await drawCompanyLogo(doc, logoX, logoY, logoMaxHeight, company.logo_url, company.name || 'Company');
    const textX = logoX + logoResult.width + 4; // Dynamic spacing based on logo width
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(company.name.toUpperCase() || 'VOTRE SOCIÉTÉ', textX, y);
    y += 6;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    if (company.activity) {
      doc.text(company.activity.toUpperCase(), textX, y);
      y += 5;
    }
    
    // if (company.address) {
    //   doc.text(company.address, textX, y);
    //   y += 5;
    // }
    if (company.address ||company.postal_code || company.city) {
      doc.text(`${company.address.toUpperCase() || ''} ${company.postal_code || ''} ${company.city.toUpperCase() || ''}`.trim(), textX, y);
      y += 5;
    }
    if (company.phone) {
      doc.text(`GSM: ${company.phone}`, textX, y);
      y += 5;
    }
    if (company.tax_id) {
      doc.text(`M.F: ${company.tax_id}`, textX, y);
      y += 5;
    }
    if (company.trade_register) {
      doc.text(`RC: ${company.trade_register}`, textX, y);
      y += 5;
    }
    // Show first bank RIB if available
    console.log('Drawing header - bank_accounts:', company.bank_accounts);
    if (company.bank_accounts && company.bank_accounts.length > 0) {
      const b = company.bank_accounts[0];
      console.log('First bank account:', b);
      if (b && (b.rib || b.bank)) {
        const prefix = getBankPrefix(b.bank || '');
        const ribText = prefix ? `RIB: ${prefix} : ${b.rib}` : `RIB: ${b.bank || ''} : ${b.rib || ''}`;
        console.log('RIB text:', ribText);
        doc.text(ribText, textX, y);
        y += 5;
      }
    }
  }
  
  // Title on right side
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth - 20, 30, { align: 'right' });
  
  return Math.max(y + 10, 55);
}

// Common client info box matching Relevé Client style with full details - Two column layout
function drawClientInfoBox(
  doc: jsPDF,
  pageWidth: number,
  y: number,
  client: InvoiceTemplateData['client']
): number {
  if (!client) return y;
  
  const boxX = 20;
  const boxWidth = pageWidth - 40;
  const halfWidth = boxWidth / 2;
  const rowHeight = 7;
  
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.setFontSize(9);
  
  // Row 1: Code Client | M.Fiscal
  doc.rect(boxX, y, halfWidth, rowHeight);
  doc.rect(boxX + halfWidth, y, halfWidth, rowHeight);
  doc.setFont('helvetica', 'bold');
  doc.text('Code Client:', boxX + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  const clientCode = client.id ? client.id.substring(0, 8).toUpperCase() : 'N/A';
  doc.text(clientCode, boxX + 30, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.text('M.Fiscal:', boxX + halfWidth + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(client.vat_number || client.siret || '', boxX + halfWidth + 25, y + 5);
  
  // Row 2: Client name (full width)
  y += rowHeight;
  doc.rect(boxX, y, boxWidth, rowHeight);
  doc.setFont('helvetica', 'bold');
  doc.text('Client:', boxX + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(client.name || '', boxX + 22, y + 5);
  
  // Row 3: Address (full width)
  y += rowHeight;
  doc.rect(boxX, y, boxWidth, rowHeight);
  doc.setFont('helvetica', 'bold');
  doc.text('Adresse:', boxX + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  const fullAddress = [client.address, client.postal_code, client.city].filter(Boolean).join(', ');
  doc.text(fullAddress || '', boxX + 25, y + 5);
  
  // Row 4: Phone | Email
  y += rowHeight;
  doc.rect(boxX, y, halfWidth, rowHeight);
  doc.rect(boxX + halfWidth, y, halfWidth, rowHeight);
  doc.setFont('helvetica', 'bold');
  doc.text('Tél:', boxX + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(client.phone || '', boxX + 15, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.text('Email:', boxX + halfWidth + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(client.email || '', boxX + halfWidth + 20, y + 5);
  
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

// Common footer matching Relevé Client style with mini logo
async function drawProfessionalFooter(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  pageNumber: number,
  company: InvoiceTemplateData['company']
): Promise<void> {
  // Page number at bottom right
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(pageNumber.toString(), pageWidth - 20, pageHeight - 10, { align: 'right' });
  
  // Company info with mini logo at bottom
  if (company) {
    const miniLogoSize = 6;
    const footerY = pageHeight - 12;
    
    // Draw mini logo and get width
    // const logoResult = await drawCompanyLogo(doc, 15, footerY, miniLogoSize, company.logo_url, company.name || 'Company');
    
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const footerParts = [];
    if (company.name) footerParts.push(company.name);
    if (company.address) footerParts.push(company.address);
    if (company.email) footerParts.push(company.email);
    
    const footerText = footerParts.join(' - ');
    doc.text(footerText, 18, pageHeight - 10);
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
    doc.text('', pageWidth - 55, y + 25, { align: 'center' });
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
  let y = await drawProfessionalHeader(doc, pageWidth, invoice.company, invoice.document_title || 'FACTURE');
  
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
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('REF', 22, tableTop + 5.5);
  doc.text('DESIGNATION', 40, tableTop + 5.5);
  doc.text('QTE', 105, tableTop + 5.5);
  doc.text('P.U.HT', 120, tableTop + 5.5);
  // Determine if any FODEC applies
  const anyFodec = items.some(i => (i.fodec_amount || 0) > 0);
  doc.text('TVA', anyFodec ? 155 : 145, tableTop + 5.5);
  if (anyFodec) {
    doc.text('FODEC', 140, tableTop + 5.5);
    doc.text('TOTAL HT', 170, tableTop + 5.5);
  } else {
    doc.text('TOTAL HT', 165, tableTop + 5.5);
  }
  
  y = tableTop + 8;
  doc.setFont('helvetica', 'normal');
  
  console.log('Drawing items table - items count:', items.length);
  console.log('Items:', items);
  
  items.forEach((item) => {
    doc.setDrawColor(200, 200, 200);
    doc.rect(20, y, pageWidth - 40, 8);
    
    doc.text((item.reference || '').substring(0, 10), 22, y + 5.5);
    doc.text(item.description.substring(0, 30), 40, y + 5.5);
    doc.text(item.quantity.toString(), 107, y + 5.5);
    doc.text(formatCurrency(item.unit_price, invoice.currency), 120, y + 5.5);
    if (anyFodec) {
      doc.text(formatCurrency(item.fodec_amount || 0, invoice.currency), 140, y + 5.5);
      doc.text(item.vat_rate ? `${item.vat_rate}%` : '00', 155, y + 5.5);
      doc.text(formatCurrency(item.total, invoice.currency), 170, y + 5.5);
    } else {
      doc.text(item.vat_rate ? `${item.vat_rate}%` : '00', 145, y + 5.5);
      doc.text(formatCurrency(item.total, invoice.currency), 165, y + 5.5);
    }
    y += 8;
  });
  
  // Totals section
  y += 10;
  doc.setFontSize(10);
  doc.text('Sous-total HT:', 130, y);
  doc.text(formatCurrency(invoice.subtotal, invoice.currency), pageWidth - 25, y, { align: 'right' });
  
  // Discount (Remise)
  if ((invoice.discount_amount || 0) > 0) {
    y += 7;
    const discountLabel = invoice.discount_type === 'percent' 
      ? `Remise (${invoice.discount_value}%):` 
      : 'Remise:';
    doc.text(discountLabel, 130, y);
    doc.text(`-${formatCurrency(invoice.discount_amount || 0, invoice.currency)}`, pageWidth - 25, y, { align: 'right' });
  }
  
  if ((invoice.fodec_amount_total || 0) > 0) {
    y += 7;
    doc.text('Total FODEC:', 130, y);
    doc.text(formatCurrency(invoice.fodec_amount_total || 0, invoice.currency), pageWidth - 25, y, { align: 'right' });
  }
  y += 7;
  doc.text('Base TVA:', 130, y);
  doc.text(formatCurrency(invoice.base_tva || (invoice.subtotal + (invoice.fodec_amount_total || 0)), invoice.currency), pageWidth - 25, y, { align: 'right' });
  y += 7;
  doc.text('Montant TVA:', 130, y);
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
  await drawProfessionalFooter(doc, pageWidth, pageHeight, 1, invoice.company);
  
  doc.save(`facture-${invoice.invoice_number}.pdf`);
}

// Template Moderne
export async function generateModernPDF(invoice: InvoiceTemplateData, items: InvoiceItem[]): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Professional header
  let y = await drawProfessionalHeader(doc, pageWidth, invoice.company, invoice.document_title || 'FACTURE');
  
  // Invoice info box
  y = drawInvoiceInfoBox(doc, pageWidth, y, invoice);
  
  // Client info box
  y = drawClientInfoBox(doc, pageWidth, y, invoice.client);
  
  // Table with blue header
  doc.setFillColor(41, 98, 255);
  doc.rect(20, y, pageWidth - 40, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('REF', 22, y + 5.5);
  doc.text('DESIGNATION', 40, y + 5.5);
  doc.text('QTE', 105, y + 5.5);
  doc.text('P.U.HT', 120, y + 5.5);
  doc.text('TVA', 145, y + 5.5);
  doc.text('TOTAL HT', 165, y + 5.5);
  
  y += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  
  items.forEach((item, index) => {
    if (index % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(20, y, pageWidth - 40, 8, 'F');
    }
    doc.text((item.reference || '').substring(0, 10), 22, y + 5.5);
    doc.text(item.description.substring(0, 30), 40, y + 5.5);
    doc.text(item.quantity.toString(), 107, y + 5.5);
    doc.text(formatCurrency(item.unit_price, invoice.currency), 120, y + 5.5);
    doc.text(item.vat_rate ? `${item.vat_rate}%` : 'Exo', 145, y + 5.5);
    doc.text(formatCurrency(item.total, invoice.currency), 165, y + 5.5);
    y += 8;
  });
  
  // Totals with colored background
  y += 5;
  doc.setFillColor(245, 247, 250);
  let boxHeight = 35;
  if (invoice.stamp_included) boxHeight += 8;
  if ((invoice.discount_amount || 0) > 0) boxHeight += 8;
  doc.roundedRect(120, y - 3, 70, boxHeight, 3, 3, 'F');
  
  let totalsY = y + 5;
  doc.setFontSize(10);
  doc.text('Sous-total HT:', 125, totalsY);
  doc.text(formatCurrency(invoice.subtotal, invoice.currency), 185, totalsY, { align: 'right' });
  
  // Discount
  if ((invoice.discount_amount || 0) > 0) {
    totalsY += 8;
    const discountLabel = invoice.discount_type === 'percent' 
      ? `Remise (${invoice.discount_value}%):` 
      : 'Remise:';
    doc.text(discountLabel, 125, totalsY);
    doc.text(`-${formatCurrency(invoice.discount_amount || 0, invoice.currency)}`, 185, totalsY, { align: 'right' });
  }
  
  if ((invoice.fodec_amount_total || 0) > 0) {
    totalsY += 8;
    doc.text('FODEC:', 125, totalsY);
    doc.text(formatCurrency(invoice.fodec_amount_total || 0, invoice.currency), 185, totalsY, { align: 'right' });
  }
  totalsY += 8;
  doc.text('Montant TVA:', 125, totalsY);
  doc.text(formatCurrency(invoice.tax_amount, invoice.currency), 185, totalsY, { align: 'right' });
  if (invoice.stamp_included) {
    totalsY += 8;
    doc.text('Timbre fiscal:', 125, totalsY);
    doc.text(formatCurrency(invoice.stamp_amount || 0, invoice.currency), 185, totalsY, { align: 'right' });
  }
  
  totalsY += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(41, 98, 255);
  doc.text('TOTAL TTC:', 125, totalsY);
  doc.text(formatCurrency(invoice.total, invoice.currency), 185, totalsY, { align: 'right' });
  
  y = totalsY;
  
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
  await drawProfessionalFooter(doc, pageWidth, pageHeight, 1, invoice.company);
  
  doc.save(`facture-${invoice.invoice_number}.pdf`);
}

// Template Minimaliste
export async function generateMinimalPDF(invoice: InvoiceTemplateData, items: InvoiceItem[]): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Professional header
  let y = await drawProfessionalHeader(doc, pageWidth, invoice.company, invoice.document_title || 'FACTURE');
  
  // Invoice info box
  y = drawInvoiceInfoBox(doc, pageWidth, y, invoice);
  
  // Client info box
  y = drawClientInfoBox(doc, pageWidth, y, invoice.client);
  
  // Simple table header
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('REF', 22, y);
  doc.text('DESCRIPTION', 40, y);
  doc.text('QTÉ', 105, y);
  doc.text('P.U.HT', 120, y);
  doc.text('TVA', 145, y);
  doc.text('TOTAL HT', pageWidth - 25, y, { align: 'right' });
  
  y += 3;
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);
  
  y += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  
  items.forEach((item) => {
    doc.text((item.reference || '').substring(0, 10), 22, y);
    doc.text(item.description.substring(0, 28), 40, y);
    doc.text(item.quantity.toString(), 107, y);
    doc.text(formatCurrency(item.unit_price, invoice.currency), 120, y);
    doc.text(item.vat_rate ? `${item.vat_rate}%` : 'Exo', 145, y);
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
  
  // Discount
  if ((invoice.discount_amount || 0) > 0) {
    y += 7;
    doc.setTextColor(120, 120, 120);
    const discountLabel = invoice.discount_type === 'percent' 
      ? `Remise (${invoice.discount_value}%)` 
      : 'Remise';
    doc.text(discountLabel, 140, y);
    doc.setTextColor(0, 0, 0);
    doc.text(`-${formatCurrency(invoice.discount_amount || 0, invoice.currency)}`, pageWidth - 25, y, { align: 'right' });
  }
  
  y += 7;
  doc.setTextColor(120, 120, 120);
  doc.text('TVA', 140, y);
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
  await drawProfessionalFooter(doc, pageWidth, pageHeight, 1, invoice.company);
  
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
