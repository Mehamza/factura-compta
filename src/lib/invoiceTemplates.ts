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
  party_type?: 'client' | 'fournisseur';
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
  const raw = String(companyName ?? '').trim();
  if (!raw) return 'CO';

  // Use the first letter of the first two words.
  // Fallback: if only one word, use its first two characters.
  const words = raw
    .split(/\s+/)
    .map(w => w.replace(/[^0-9a-zA-Z]/g, ''))
    .filter(Boolean);

  if (words.length >= 2) {
    return ((words[0][0] || '') + (words[1][0] || '')).toUpperCase() || 'CO';
  }

  const one = (words[0] || raw).replace(/[^0-9a-zA-Z]/g, '');
  const two = (one || 'CO').substring(0, 2);
  return two.toUpperCase();
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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  // h in [0..360), s/l in [0..1]
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hp >= 0 && hp < 1) {
    r1 = c;
    g1 = x;
  } else if (hp >= 1 && hp < 2) {
    r1 = x;
    g1 = c;
  } else if (hp >= 2 && hp < 3) {
    g1 = c;
    b1 = x;
  } else if (hp >= 3 && hp < 4) {
    g1 = x;
    b1 = c;
  } else if (hp >= 4 && hp < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const m = l - c / 2;
  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);
  return [r, g, b];
}

function getThemeMutedRgb(fallback: [number, number, number] = [240, 240, 240]): [number, number, number] {
  // shadcn/ui uses: bg-muted => hsl(var(--muted))
  // --muted is typically stored as "H S% L%" (e.g. "210 40% 96.1%")
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;

  const raw = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
  if (!raw) return fallback;

  // Accept formats:
  // - "210 40% 96.1%" (shadcn)
  // - "hsl(210 40% 96.1%)"
  // - "rgb(240, 240, 240)"
  const normalized = raw.replace(/^hsl\(|\)$/g, '').trim();

  const rgbMatch = normalized.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    return [
      Number(rgbMatch[1]) || fallback[0],
      Number(rgbMatch[2]) || fallback[1],
      Number(rgbMatch[3]) || fallback[2],
    ];
  }

  const parts = normalized.split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return fallback;

  const h = Number(parts[0]);
  const s = Number(parts[1].replace('%', '')) / 100;
  const l = Number(parts[2].replace('%', '')) / 100;

  if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) return fallback;
  return hslToRgb(h, clamp01(s), clamp01(l));
}

function getThemePrimaryRgb(fallback: [number, number, number] = [37, 99, 235]): [number, number, number] {
  // shadcn/ui uses: bg-primary => hsl(var(--primary))
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;

  const raw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  if (!raw) return fallback;

  const normalized = raw.replace(/^hsl\(|\)$/g, '').trim();
  const rgbMatch = normalized.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    return [
      Number(rgbMatch[1]) || fallback[0],
      Number(rgbMatch[2]) || fallback[1],
      Number(rgbMatch[3]) || fallback[2],
    ];
  }

  const parts = normalized.split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return fallback;

  const h = Number(parts[0]);
  const s = Number(parts[1].replace('%', '')) / 100;
  const l = Number(parts[2].replace('%', '')) / 100;
  if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) return fallback;
  return hslToRgb(h, clamp01(s), clamp01(l));
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
  // Draw rectangle background using app primary color (fallback to #2563eb)
  const [pr, pg, pb] = getThemePrimaryRgb([37, 99, 235]);
  doc.setFillColor(pr, pg, pb);
  doc.rect(rectX, rectY, rectW, rectH, 'F');

  // Draw initials in white, centered
  const centerX = rectX + rectW / 2;
  const centerY = rectY + rectH / 2;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  // Make initials fill the logo height, then shrink if too wide.
  let fontSize = size * 1.05;
  doc.setFontSize(fontSize);
  const maxWidth = size * 0.96;
  const currentWidth = doc.getTextWidth(initials) || 1;
  if (currentWidth > maxWidth) {
    fontSize = fontSize * (maxWidth / currentWidth);
    doc.setFontSize(fontSize);
  }
  // jsPDF uses baseline Y; this offset keeps large letters visually centered.
  doc.text(initials, centerX, rectY + rectH * 0.72, { align: 'center' });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
}

type InvoicePdfOutput = {
  output?: 'save' | 'blob';
  fileName?: string;
};

function finalizeInvoicePdf(doc: jsPDF, invoiceNumber: string, options?: InvoicePdfOutput): Blob | void {
  const fileName = options?.fileName || `facture-${invoiceNumber}.pdf`;
  if (options?.output === 'blob') {
    return doc.output('blob');
  }
  doc.save(fileName);
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
  title: string,
  headerDate: string | undefined,
  margin: number = 20
): Promise<number> {
  const headerY = 10;
  let y = headerY;
  
  // Company info on left with logo
  if (company) {
    const logoMaxHeight = 18;
    const logoX = margin;
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
    if (company.bank_accounts && company.bank_accounts.length > 0) {
      const b = company.bank_accounts[0];
      if (b && (b.rib || b.bank)) {
        const prefix = getBankPrefix(b.bank || '');
        const ribText = prefix ? `RIB: ${prefix} : ${b.rib}` : `RIB: ${b.bank || ''} : ${b.rib || ''}`;
        doc.text(ribText, textX, y);
        y += 5;
      }
    }
  }
  
  // Title on right side
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth - margin, headerY, { align: 'right' });

  // Date directly under the title (top-right block)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const dateToShow = headerDate ? new Date(headerDate).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
  doc.text(`Le ${dateToShow}`, pageWidth - margin, headerY + 6, { align: 'right' });
  
  return Math.max(y + 4, 40);
}

// Common client info box matching Relevé Client style with full details - Two column layout
function drawClientInfoBox(
  doc: jsPDF,
  pageWidth: number,
  y: number,
  client: InvoiceTemplateData['client'],
  partyType: 'client' | 'fournisseur' = 'client',
  margin: number = 20
): number {
  if (!client) return y;
  
  const boxX = margin;
  const boxWidth = pageWidth - margin * 2;
  const halfWidth = boxWidth / 2;
  const rowHeight = 7;
  const paddingX = 3;
  const gapX = 2;
  
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.setFontSize(9);
  
  // Row 1: Code Client | M.Fiscal
  doc.rect(boxX, y, halfWidth, rowHeight);
  doc.rect(boxX + halfWidth, y, halfWidth, rowHeight);
  doc.setFont('helvetica', 'bold');
  const codeLabel = partyType === 'fournisseur' ? 'Code Fournisseur:' : 'Code Client:';
  const codeLabelX = boxX + paddingX;
  doc.text(codeLabel, codeLabelX, y + 5);
  doc.setFont('helvetica', 'normal');
  const clientCode = client.id ? client.id.substring(0, 8).toUpperCase() : 'N/A';
  const codeValueX = Math.max(boxX + 30, codeLabelX + doc.getTextWidth(codeLabel) + gapX);
  doc.text(clientCode, codeValueX, y + 5, {
    maxWidth: Math.max(0, boxX + halfWidth - paddingX - codeValueX),
  });
  doc.setFont('helvetica', 'bold');
  const fiscalLabel = 'M.Fiscal:';
  const fiscalLabelX = boxX + halfWidth + paddingX;
  doc.text(fiscalLabel, fiscalLabelX, y + 5);
  doc.setFont('helvetica', 'normal');
  const fiscalValueX = Math.max(
    boxX + halfWidth + 25,
    fiscalLabelX + doc.getTextWidth(fiscalLabel) + gapX
  );
  doc.text(client.vat_number || client.siret || '', fiscalValueX, y + 5, {
    maxWidth: Math.max(0, boxX + boxWidth - paddingX - fiscalValueX),
  });
  
  // Row 2: Client name (full width)
  y += rowHeight;
  doc.rect(boxX, y, boxWidth, rowHeight);
  doc.setFont('helvetica', 'bold');
  const nameLabel = partyType === 'fournisseur' ? 'Fournisseur:' : 'Client:';
  const nameLabelX = boxX + paddingX;
  doc.text(nameLabel, nameLabelX, y + 5);
  doc.setFont('helvetica', 'normal');
  const nameValueX = Math.max(boxX + 22, nameLabelX + doc.getTextWidth(nameLabel) + gapX);
  doc.text(client.name || '', nameValueX, y + 5, {
    maxWidth: Math.max(0, boxX + boxWidth - paddingX - nameValueX),
  });
  
  // Row 3: Address (full width)
  y += rowHeight;
  doc.rect(boxX, y, boxWidth, rowHeight);
  doc.setFont('helvetica', 'bold');
  const addressLabel = 'Adresse:';
  const addressLabelX = boxX + paddingX;
  doc.text(addressLabel, addressLabelX, y + 5);
  doc.setFont('helvetica', 'normal');
  const fullAddress = [client.address, client.postal_code, client.city].filter(Boolean).join(', ');
  const addressValueX = Math.max(boxX + 25, addressLabelX + doc.getTextWidth(addressLabel) + gapX);
  doc.text(fullAddress || '', addressValueX, y + 5, {
    maxWidth: Math.max(0, boxX + boxWidth - paddingX - addressValueX),
  });
  
  // Row 4: Phone | Email
  y += rowHeight;
  doc.rect(boxX, y, halfWidth, rowHeight);
  doc.rect(boxX + halfWidth, y, halfWidth, rowHeight);
  doc.setFont('helvetica', 'bold');
  const phoneLabel = 'Tél:';
  const phoneLabelX = boxX + paddingX;
  doc.text(phoneLabel, phoneLabelX, y + 5);
  doc.setFont('helvetica', 'normal');
  const phoneValueX = Math.max(boxX + 15, phoneLabelX + doc.getTextWidth(phoneLabel) + gapX);
  doc.text(client.phone || '', phoneValueX, y + 5, {
    maxWidth: Math.max(0, boxX + halfWidth - paddingX - phoneValueX),
  });
  doc.setFont('helvetica', 'bold');
  const emailLabel = 'Email:';
  const emailLabelX = boxX + halfWidth + paddingX;
  doc.text(emailLabel, emailLabelX, y + 5);
  doc.setFont('helvetica', 'normal');
  const emailValueX = Math.max(
    boxX + halfWidth + 20,
    emailLabelX + doc.getTextWidth(emailLabel) + gapX
  );
  doc.text(client.email || '', emailValueX, y + 5, {
    maxWidth: Math.max(0, boxX + boxWidth - paddingX - emailValueX),
  });
  
  return y + rowHeight + 4;
}

// Common invoice info box
function drawInvoiceInfoBox(
  doc: jsPDF,
  pageWidth: number,
  y: number,
  invoice: InvoiceTemplateData,
  margin: number = 20
): number {
  const boxX = margin;
  const boxWidth = pageWidth - margin * 2;
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
  
  return y + boxHeight + 4;
}

// Common footer matching Relevé Client style with mini logo
async function drawProfessionalFooter(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  pageNumber: number,
  company: InvoiceTemplateData['company'],
  margin: number = 20
): Promise<void> {
  // Page number at bottom right
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(pageNumber.toString(), pageWidth - margin, pageHeight - 10, { align: 'right' });
  
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
    doc.text(footerText, margin, pageHeight - 10);
  }
  
  doc.setTextColor(0, 0, 0);
}

// Stamp zone function
async function drawStampZone(
  doc: jsPDF,
  y: number,
  pageWidth: number,
  signatureUrl?: string,
  stampUrl?: string,
  margin: number = 20
): Promise<number> {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const boxHeight = 35;
  const boxWidth = 70;
  const boxX = pageWidth - margin - boxWidth;
  doc.text('Cachet & Signature', boxX + boxWidth / 2, y, { align: 'center' });
  
  const boxY = y + 5;
  
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
export async function generateClassicPDF(invoice: InvoiceTemplateData, items: InvoiceItem[], options?: InvoicePdfOutput): Promise<Blob | void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const currency = currencies[invoice.currency] || currencies.TND;
  
  // Professional header
  let y = await drawProfessionalHeader(doc, pageWidth, invoice.company, invoice.document_title || 'FACTURE', invoice.issue_date, margin);
  
  // Invoice info box
  y = drawInvoiceInfoBox(doc, pageWidth, y, invoice, margin);
  
  // Client info box
  y = drawClientInfoBox(doc, pageWidth, y, invoice.client, invoice.party_type || 'client', margin);
  
  // Table header
  const tableTop = y;
  const [mutedR, mutedG, mutedB] = getThemeMutedRgb([240, 240, 240]);
  doc.setFillColor(mutedR, mutedG, mutedB);
  doc.rect(margin, tableTop, contentWidth, 8, 'F');
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(margin, tableTop, contentWidth, 8);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('REF', margin + 2, tableTop + 5.5);
  doc.text('DESIGNATION', margin + 20, tableTop + 5.5);
  doc.text('QTE', margin + 85, tableTop + 5.5);
  doc.text('P.U.HT', margin + 100, tableTop + 5.5);
  // Determine if any FODEC applies
  const anyFodec = items.some(i => (i.fodec_amount || 0) > 0);
  doc.text('TVA', anyFodec ? margin + 135 : margin + 125, tableTop + 5.5);
  if (anyFodec) {
    doc.text('FODEC', margin + 120, tableTop + 5.5);
    doc.text('TOTAL HT', margin + 150, tableTop + 5.5);
  } else {
    doc.text('TOTAL HT', margin + 145, tableTop + 5.5);
  }
  
  y = tableTop + 8;
  doc.setFont('helvetica', 'normal');
  
  console.log('Drawing items table - items count:', items.length);
  console.log('Items:', items);
  
  items.forEach((item) => {
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, contentWidth, 8);
    
    doc.text((item.reference || '').substring(0, 10), margin + 2, y + 5.5);
    doc.text(item.description.substring(0, 30), margin + 20, y + 5.5);
    doc.text(item.quantity.toString(), margin + 87, y + 5.5);
    doc.text(formatCurrency(item.unit_price, invoice.currency), margin + 100, y + 5.5);
    if (anyFodec) {
      doc.text(formatCurrency(item.fodec_amount || 0, invoice.currency), margin + 120, y + 5.5);
      doc.text(item.vat_rate ? `${item.vat_rate}%` : '00', margin + 135, y + 5.5);
      doc.text(formatCurrency(item.total, invoice.currency), margin + 150, y + 5.5);
    } else {
      doc.text(item.vat_rate ? `${item.vat_rate}%` : '00', margin + 125, y + 5.5);
      doc.text(formatCurrency(item.total, invoice.currency), margin + 145, y + 5.5);
    }
    y += 8;
  });
  
  // Totals section
  y += 4;
  doc.setFontSize(10);
  doc.text('Sous-total HT:', 130, y);
  doc.text(formatCurrency(invoice.subtotal, invoice.currency), pageWidth - margin - 5, y, { align: 'right' });
  
  // Discount (Remise)
  if ((invoice.discount_amount || 0) > 0) {
    y += 7;
    const discountLabel = invoice.discount_type === 'percent' 
      ? `Remise (${invoice.discount_value}%):` 
      : 'Remise:';
    doc.text(discountLabel, 130, y);
    doc.text(`-${formatCurrency(invoice.discount_amount || 0, invoice.currency)}`, pageWidth - margin - 5, y, { align: 'right' });
  }
  
  if ((invoice.fodec_amount_total || 0) > 0) {
    y += 7;
    doc.text('Total FODEC:', 130, y);
    doc.text(formatCurrency(invoice.fodec_amount_total || 0, invoice.currency), pageWidth - margin - 5, y, { align: 'right' });
  }
  y += 7;
  doc.text('Base TVA:', 130, y);
  doc.text(formatCurrency(invoice.base_tva || (invoice.subtotal + (invoice.fodec_amount_total || 0)), invoice.currency), pageWidth - margin - 5, y, { align: 'right' });
  y += 7;
  doc.text('Montant TVA:', 130, y);
  doc.text(formatCurrency(invoice.tax_amount, invoice.currency), pageWidth - margin - 5, y, { align: 'right' });
  if (invoice.stamp_included) {
    y += 7;
    doc.text('Timbre fiscal:', 130, y);
    doc.text(formatCurrency(invoice.stamp_amount || 0, invoice.currency), pageWidth - margin - 5, y, { align: 'right' });
  }
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total TTC:', 130, y);
  doc.text(formatCurrency(invoice.total, invoice.currency), pageWidth - margin - 5, y, { align: 'right' });
  
  // Amount in words
  y += 12;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('Arrêté la présente facture à la somme de:', margin, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(numberToWords(invoice.total, invoice.currency), margin, y);
  
  // Notes
  if (invoice.notes) {
    y += 15;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Notes:', margin, y);
    y += 5;
    doc.text(invoice.notes.substring(0, 200), margin, y);
  }
  
  // Stamp zone
  y = Math.max(y + 20, 220);
  await drawStampZone(doc, y, pageWidth, invoice.company?.signature_url, invoice.company?.stamp_url, margin);
  
  // Created by info
  if (invoice.created_by) {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    let infoY = y;
    doc.text('Émis par:', margin, infoY);
    infoY += 4;
    if (invoice.created_by.name) doc.text(invoice.created_by.name, margin, infoY);
    if (invoice.created_by.role) { infoY += 4; doc.text(`Rôle: ${invoice.created_by.role}`, margin, infoY); }
    if (invoice.created_by.created_at) {
      infoY += 4;
      doc.text(`Le: ${new Date(invoice.created_by.created_at).toLocaleString('fr-FR')}`, margin, infoY);
    }
    doc.setTextColor(0, 0, 0);
  }
  
  // Professional footer
  await drawProfessionalFooter(doc, pageWidth, pageHeight, 1, invoice.company, margin);
  
  return finalizeInvoicePdf(doc, invoice.invoice_number, options);
}

// Template Moderne
export async function generateModernPDF(invoice: InvoiceTemplateData, items: InvoiceItem[], options?: InvoicePdfOutput): Promise<Blob | void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  
  // Professional header
  let y = await drawProfessionalHeader(doc, pageWidth, invoice.company, invoice.document_title || 'FACTURE', invoice.issue_date, margin);
  
  // Invoice info box
  y = drawInvoiceInfoBox(doc, pageWidth, y, invoice, margin);
  
  // Client info box
  y = drawClientInfoBox(doc, pageWidth, y, invoice.client, invoice.party_type || 'client', margin);
  
  // Table with blue header
  doc.setFillColor(41, 98, 255);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('REF', margin + 2, y + 5.5);
  doc.text('DESIGNATION', margin + 20, y + 5.5);
  doc.text('QTE', margin + 85, y + 5.5);
  doc.text('P.U.HT', margin + 100, y + 5.5);
  doc.text('TVA', margin + 125, y + 5.5);
  doc.text('TOTAL HT', margin + 145, y + 5.5);
  
  y += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  
  items.forEach((item, index) => {
    if (index % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, y, contentWidth, 8, 'F');
    }
    doc.text((item.reference || '').substring(0, 10), margin + 2, y + 5.5);
    doc.text(item.description.substring(0, 30), margin + 20, y + 5.5);
    doc.text(item.quantity.toString(), margin + 87, y + 5.5);
    doc.text(formatCurrency(item.unit_price, invoice.currency), margin + 100, y + 5.5);
    doc.text(item.vat_rate ? `${item.vat_rate}%` : 'Exo', margin + 125, y + 5.5);
    doc.text(formatCurrency(item.total, invoice.currency), margin + 145, y + 5.5);
    y += 8;
  });
  
  // Totals with colored background
  y += 5;
  doc.setFillColor(245, 247, 250);
  let boxHeight = 35;
  if (invoice.stamp_included) boxHeight += 8;
  if ((invoice.discount_amount || 0) > 0) boxHeight += 8;
  const totalsBoxWidth = 70;
  const totalsBoxX = pageWidth - margin - totalsBoxWidth;
  doc.roundedRect(totalsBoxX, y - 3, totalsBoxWidth, boxHeight, 3, 3, 'F');
  
  let totalsY = y + 5;
  doc.setFontSize(10);
  doc.text('Sous-total HT:', totalsBoxX + 5, totalsY);
  doc.text(formatCurrency(invoice.subtotal, invoice.currency), pageWidth - margin - 5, totalsY, { align: 'right' });
  
  // Discount
  if ((invoice.discount_amount || 0) > 0) {
    totalsY += 8;
    const discountLabel = invoice.discount_type === 'percent' 
      ? `Remise (${invoice.discount_value}%):` 
      : 'Remise:';
    doc.text(discountLabel, totalsBoxX + 5, totalsY);
    doc.text(`-${formatCurrency(invoice.discount_amount || 0, invoice.currency)}`, pageWidth - margin - 5, totalsY, { align: 'right' });
  }
  
  if ((invoice.fodec_amount_total || 0) > 0) {
    totalsY += 8;
    doc.text('FODEC:', totalsBoxX + 5, totalsY);
    doc.text(formatCurrency(invoice.fodec_amount_total || 0, invoice.currency), pageWidth - margin - 5, totalsY, { align: 'right' });
  }
  totalsY += 8;
  doc.text('Montant TVA:', totalsBoxX + 5, totalsY);
  doc.text(formatCurrency(invoice.tax_amount, invoice.currency), pageWidth - margin - 5, totalsY, { align: 'right' });
  if (invoice.stamp_included) {
    totalsY += 8;
    doc.text('Timbre fiscal:', totalsBoxX + 5, totalsY);
    doc.text(formatCurrency(invoice.stamp_amount || 0, invoice.currency), pageWidth - margin - 5, totalsY, { align: 'right' });
  }
  
  totalsY += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(41, 98, 255);
  doc.text('TOTAL TTC:', totalsBoxX + 5, totalsY);
  doc.text(formatCurrency(invoice.total, invoice.currency), pageWidth - margin - 5, totalsY, { align: 'right' });
  
  y = totalsY;
  
  // Amount in words
  y += 40;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('Montant en lettres:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(numberToWords(invoice.total, invoice.currency), margin, y + 6);
  
  // Notes
  if (invoice.notes) {
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.text('Notes: ' + invoice.notes.substring(0, 150), margin, y);
  }
  
  // Stamp zone
  y = Math.max(y + 20, 210);
  await drawStampZone(doc, y, pageWidth, invoice.company?.signature_url, invoice.company?.stamp_url, margin);
  
  // Created by info
  if (invoice.created_by) {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    let infoY = y;
    doc.text('Émis par:', margin, infoY);
    if (invoice.created_by.name) { infoY += 4; doc.text(invoice.created_by.name, margin, infoY); }
    if (invoice.created_by.role) { infoY += 4; doc.text(`Rôle: ${invoice.created_by.role}`, margin, infoY); }
    if (invoice.created_by.created_at) {
      infoY += 4;
      doc.text(`Le: ${new Date(invoice.created_by.created_at).toLocaleString('fr-FR')}`, margin, infoY);
    }
    doc.setTextColor(0, 0, 0);
  }
  
  // Professional footer
  await drawProfessionalFooter(doc, pageWidth, pageHeight, 1, invoice.company, margin);
  
  return finalizeInvoicePdf(doc, invoice.invoice_number, options);
}

// Template Minimaliste
export async function generateMinimalPDF(invoice: InvoiceTemplateData, items: InvoiceItem[], options?: InvoicePdfOutput): Promise<Blob | void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  
  // Professional header
  let y = await drawProfessionalHeader(doc, pageWidth, invoice.company, invoice.document_title || 'FACTURE', invoice.issue_date, margin);
  
  // Invoice info box
  y = drawInvoiceInfoBox(doc, pageWidth, y, invoice, margin);
  
  // Client info box
  y = drawClientInfoBox(doc, pageWidth, y, invoice.client, invoice.party_type || 'client', margin);
  
  // Simple table header
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('REF', margin + 2, y);
  doc.text('DESCRIPTION', margin + 20, y);
  doc.text('QTÉ', margin + 85, y);
  doc.text('P.U.HT', margin + 100, y);
  doc.text('TVA', margin + 125, y);
  doc.text('TOTAL HT', pageWidth - margin - 5, y, { align: 'right' });
  
  y += 3;
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  
  y += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  
  items.forEach((item) => {
    doc.text((item.reference || '').substring(0, 10), margin + 2, y);
    doc.text(item.description.substring(0, 28), margin + 20, y);
    doc.text(item.quantity.toString(), margin + 87, y);
    doc.text(formatCurrency(item.unit_price, invoice.currency), margin + 100, y);
    doc.text(item.vat_rate ? `${item.vat_rate}%` : 'Exo', margin + 125, y);
    doc.text(formatCurrency(item.total, invoice.currency), pageWidth - margin - 5, y, { align: 'right' });
    y += 8;
  });
  
  y += 5;
  doc.setDrawColor(230, 230, 230);
  doc.line(120, y, pageWidth - margin, y);
  
  // Totals
  y += 4;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Sous-total HT', 140, y);
  doc.setTextColor(0, 0, 0);
  doc.text(formatCurrency(invoice.subtotal, invoice.currency), pageWidth - margin - 5, y, { align: 'right' });
  
  // Discount
  if ((invoice.discount_amount || 0) > 0) {
    y += 7;
    doc.setTextColor(120, 120, 120);
    const discountLabel = invoice.discount_type === 'percent' 
      ? `Remise (${invoice.discount_value}%)` 
      : 'Remise';
    doc.text(discountLabel, 140, y);
    doc.setTextColor(0, 0, 0);
    doc.text(`-${formatCurrency(invoice.discount_amount || 0, invoice.currency)}`, pageWidth - margin - 5, y, { align: 'right' });
  }
  
  y += 7;
  doc.setTextColor(120, 120, 120);
  doc.text('TVA', 140, y);
  doc.setTextColor(0, 0, 0);
  doc.text(formatCurrency(invoice.tax_amount, invoice.currency), pageWidth - margin - 5, y, { align: 'right' });
  if (invoice.stamp_included) {
    y += 7;
    doc.setTextColor(120, 120, 120);
    doc.text('Timbre fiscal', 140, y);
    doc.setTextColor(0, 0, 0);
    doc.text(formatCurrency(invoice.stamp_amount || 0, invoice.currency), pageWidth - margin - 5, y, { align: 'right' });
  }
  
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL TTC', 140, y);
  doc.text(formatCurrency(invoice.total, invoice.currency), pageWidth - margin - 5, y, { align: 'right' });
  
  // Amount in words
  y += 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Arrêté à:', margin, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'italic');
  doc.text(numberToWords(invoice.total, invoice.currency), margin, y + 6);
  
  // Notes
  if (invoice.notes) {
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Notes:', margin, y);
    doc.setTextColor(0, 0, 0);
    doc.text(invoice.notes.substring(0, 150), margin, y + 5);
  }
  
  // Stamp zone
  y = Math.max(y + 25, 205);
  await drawStampZone(doc, y, pageWidth, invoice.company?.signature_url, invoice.company?.stamp_url, margin);
  
  // Created by info
  if (invoice.created_by) {
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    let infoY = y;
    if (invoice.created_by.name) doc.text(`Émis par: ${invoice.created_by.name}`, margin, infoY);
    if (invoice.created_by.role) { infoY += 4; doc.text(`Rôle: ${invoice.created_by.role}`, margin, infoY); }
    if (invoice.created_by.created_at) {
      infoY += 4;
      doc.text(`Le: ${new Date(invoice.created_by.created_at).toLocaleString('fr-FR')}`, margin, infoY);
    }
    doc.setTextColor(0, 0, 0);
  }
  
  // Professional footer
  await drawProfessionalFooter(doc, pageWidth, pageHeight, 1, invoice.company, margin);
  
  return finalizeInvoicePdf(doc, invoice.invoice_number, options);
}

// Main function to generate PDF based on template
export async function generateInvoiceWithTemplate(
  invoice: InvoiceTemplateData,
  items: InvoiceItem[],
  options?: InvoicePdfOutput
): Promise<Blob | void> {
  switch (invoice.template_type) {
    case 'modern':
      return await generateModernPDF(invoice, items, options);
    case 'minimal':
      return await generateMinimalPDF(invoice, items, options);
    case 'classic':
    default:
      return await generateClassicPDF(invoice, items, options);
  }
}
