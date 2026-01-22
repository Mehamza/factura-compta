import { jsPDF } from 'jspdf';
import { ClientInvoiceStatement } from './getClientInvoiceStatement';

const formatNumber = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR');

interface ClientInfo {
  id: string;
  name: string;
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
}

// Helper to extract company initials for fallback logo
function getCompanyInitials(companyName: string): string {
  const raw = String(companyName ?? '').trim();
  if (!raw) return 'CO';

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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
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
  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
}

function getThemePrimaryRgb(fallback: [number, number, number] = [37, 99, 235]): [number, number, number] {
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
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const radius = size / 2;
  
  // Draw circle background using app primary color (fallback to #2563eb)
  const [pr, pg, pb] = getThemePrimaryRgb([37, 99, 235]);
  doc.setFillColor(pr, pg, pb);
  doc.circle(centerX, centerY, radius, 'F');
  
  // Draw initials in white
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  let fontSize = size * 0.9;
  doc.setFontSize(fontSize);
  const maxWidth = size * 0.82;
  const currentWidth = doc.getTextWidth(initials) || 1;
  if (currentWidth > maxWidth) {
    fontSize = fontSize * (maxWidth / currentWidth);
    doc.setFontSize(fontSize);
  }
  doc.text(initials, centerX, y + size * 0.68, { align: 'center' });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
}

// Load image as base64
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

export async function generateClientStatementPDF(
  statement: ClientInvoiceStatement,
  client: ClientInfo,
  companySettings: CompanySettings,
  dateRange?: { start?: string; end?: string }
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  let y = 15;
  let pageNumber = 1;
  let totalPages = 1; // Will be updated at the end

  const checkPageBreak = (neededSpace: number) => {
    if (y + neededSpace > pageHeight - 25) {
      doc.addPage();
      pageNumber++;
      y = 15;
      return true;
    }
    return false;
  };

  // Helper to draw page footer with mini logo
  const drawFooter = async (pageNum: number) => {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${pageNum}`, pageWidth - margin - 5, pageHeight - 10);
  };

  // ==================== HEADER SECTION ====================
  // Date at top right
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(`Le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - margin, y, { align: 'right' });
  
  // Company Info (left side) with logo
  y = 20;
  const logoMaxHeight = 18;
  const logoX = margin;
  const logoY = y - 3;
  
  // Draw logo and get actual width
  const logoResult = await drawCompanyLogo(doc, logoX, logoY, logoMaxHeight, companySettings.company_logo_url, companySettings.company_name || 'Company');
  const textX = logoX + logoResult.width + 4; // Dynamic spacing based on logo width
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(companySettings.company_name || 'Entreprise', textX, y);
  
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (companySettings.activity) {
    doc.text(companySettings.activity, textX, y);
    y += 4;
  }
  if (companySettings.company_address) {
    doc.text(companySettings.company_address, textX, y);
    y += 4;
  }
  if (companySettings.company_city) {
    doc.text(`${companySettings.company_postal_code || ''} ${companySettings.company_city}`.trim(), textX, y);
    y += 4;
  }
  if (companySettings.company_phone) {
    doc.text(`GSM: ${companySettings.company_phone}`, textX, y);
    y += 4;
  }
  if (companySettings.company_tax_id) {
    doc.text(`M.F: ${companySettings.company_tax_id}`, textX, y);
    y += 4;
  }

  // Title on the right side (aligned with company title line)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('RELEVÉ DES VENTES', pageWidth - margin, 20, { align: 'right' });
  
  y = Math.max(y, 50) + 5;

  // ==================== PERIOD BOX ====================
  const periodText = `Periode: ${dateRange?.start ? formatDate(dateRange.start) : '...'} - ${dateRange?.end ? formatDate(dateRange.end) : '...'}`;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(periodText, margin + 3, y + 5.5);
  y += 14;

  // ==================== CLIENT INFO BOX ====================
  const clientBoxHeight = 24;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, clientBoxHeight);
  
  // Client info rows
  doc.setFontSize(10);
  const clientRowHeight = 8;
  
  // Row 1: Code Client
  doc.line(margin, y + clientRowHeight, margin + contentWidth, y + clientRowHeight);
  doc.text('Code Client:', margin + 3, y + 5.5);
  doc.text(client.id.substring(0, 8).toUpperCase(), margin + 35, y + 5.5);
  
  // Row 2: Client
  doc.line(margin, y + clientRowHeight * 2, margin + contentWidth, y + clientRowHeight * 2);
  doc.text('Client:', margin + 3, y + clientRowHeight + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.text(client.name, margin + 35, y + clientRowHeight + 5.5);
  doc.setFont('helvetica', 'normal');
  
  // Row 3: M.Fiscal
  doc.text('M.Fiscal:', margin + 3, y + clientRowHeight * 2 + 5.5);
  doc.text(client.vat_number || '-', margin + 35, y + clientRowHeight * 2 + 5.5);
  
  y += clientBoxHeight + 8;

  // ==================== TABLE HEADER ====================
  const colWidths = {
    ref: 25,
    designation: 80,
    qty: 20,
    unitPrice: 30,
    total: 35
  };
  
  // Table header background
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setDrawColor(0, 0, 0);
  doc.rect(margin, y, contentWidth, 8);
  
  // Column headers
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  let colX = margin;
  
  doc.text('REF', colX + 2, y + 5.5);
  colX += colWidths.ref;
  doc.line(colX, y, colX, y + 8);
  
  doc.text('DESIGNATION', colX + 2, y + 5.5);
  colX += colWidths.designation;
  doc.line(colX, y, colX, y + 8);
  
  doc.text('QTE', colX + 2, y + 5.5);
  colX += colWidths.qty;
  doc.line(colX, y, colX, y + 8);
  
  doc.text('P.UTC', colX + 2, y + 5.5);
  colX += colWidths.unitPrice;
  doc.line(colX, y, colX, y + 8);
  
  doc.text('TOTAL', colX + 2, y + 5.5);
  
  y += 10;

  // ==================== INVOICE DATA ROWS ====================
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  let grandTotal = 0;

  statement.invoices.forEach((inv) => {
    // Calculate space needed for this invoice
    const itemsCount = Math.max(inv.items.length, 1);
    const neededSpace = 8 + (itemsCount * 6) + 10;
    checkPageBreak(neededSpace);

    // Invoice header row (darker background)
    doc.setFillColor(200, 200, 200);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.rect(margin, y, contentWidth, 7);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${inv.invoice_number}`, margin + 2, y + 5);
    doc.text(`DATE: ${formatDate(inv.issue_date)}`, margin + 50, y + 5);
    
    doc.setFont('helvetica', 'normal');
    y += 8;

    // Invoice items
    if (inv.items.length === 0) {
      // Draw empty row
      doc.setDrawColor(180, 180, 180);
      doc.rect(margin, y, contentWidth, 6);
      doc.setTextColor(128, 128, 128);
      doc.text('Aucun article', margin + 3, y + 4);
      doc.setTextColor(0, 0, 0);
      y += 7;
    } else {
      inv.items.forEach((item) => {
        checkPageBreak(8);
        
        // Draw row borders
        doc.setDrawColor(180, 180, 180);
        doc.rect(margin, y, contentWidth, 6);
        
        // Draw column separators
        let itemColX = margin + colWidths.ref;
        doc.line(itemColX, y, itemColX, y + 6);
        itemColX += colWidths.designation;
        doc.line(itemColX, y, itemColX, y + 6);
        itemColX += colWidths.qty;
        doc.line(itemColX, y, itemColX, y + 6);
        itemColX += colWidths.unitPrice;
        doc.line(itemColX, y, itemColX, y + 6);
        
        // Item data
        doc.setFontSize(8);
        colX = margin;
        
        // REF (use first 10 chars of description as ref or empty)
        doc.text('', colX + 2, y + 4);
        colX += colWidths.ref;
        
        // DESIGNATION (truncate if too long)
        const desc = item.description.length > 40 ? item.description.substring(0, 37) + '...' : item.description;
        doc.text(desc, colX + 2, y + 4);
        colX += colWidths.designation;
        
        // QTE
        doc.text(item.quantity.toString(), colX + 2, y + 4);
        colX += colWidths.qty;
        
        // P.UTC (Unit Price)
        doc.text(formatNumber(item.unit_price), colX + 2, y + 4);
        colX += colWidths.unitPrice;
        
        // TOTAL
        doc.text(formatNumber(item.total), colX + 2, y + 4);
        
        y += 6;
      });
    }

    // Invoice total row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const totalText = `TOTAL: ${formatNumber(inv.total_ttc)}`;
    doc.text(totalText, margin + contentWidth - 5, y + 3, { align: 'right' });
    grandTotal += inv.total_ttc;
    y += 8;
    
    doc.setFont('helvetica', 'normal');
  });

  // ==================== GRAND TOTAL ====================
  checkPageBreak(15);
  y += 5;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(margin + contentWidth - 60, y, margin + contentWidth, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`TOTAL GÉNÉRAL: ${formatNumber(grandTotal)} DT`, margin + contentWidth, y, { align: 'right' });

  // ==================== FOOTER ON ALL PAGES ====================
  const numPages = doc.getNumberOfPages();
  for (let i = 1; i <= numPages; i++) {
    doc.setPage(i);
    
    // Page number
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${i}`, pageWidth - margin - 5, pageHeight - 10);
    
    // Mini logo in footer and get width
    const miniLogoSize = 6;
    const footerLogoY = pageHeight - 12;
    const logoResult = await drawCompanyLogo(doc, margin, footerLogoY, miniLogoSize, companySettings.company_logo_url, companySettings.company_name || 'Company');
    
    // Company footer info
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    const footerText = [
      companySettings.company_name,
      companySettings.company_address,
      companySettings.company_email
    ].filter(Boolean).join(' - ');
    doc.text(footerText, margin + logoResult.width + 3, pageHeight - 10);
  }

  doc.save(`releve-ventes-${client.name.replace(/\s+/g, '_')}.pdf`);
}
