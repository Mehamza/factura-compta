import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { downloadCSV, mapInvoicesToCSV, exportServerCSV } from '@/lib/export';
import { canExportData } from '@/lib/permissions';
import { Select as UiSelect, SelectContent as UiSelectContent, SelectItem as UiSelectItem, SelectTrigger as UiSelectTrigger, SelectValue as UiSelectValue } from '@/components/ui/select';
import { Plus, Search, Download, Trash2, Eye, FileText, Printer, Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { openPdfForPrint } from '@/lib/print';
import { 
  generateInvoiceWithTemplate, 
  templateLabels, 
  templateDescriptions,
  type TemplateType,
  type InvoiceTemplateData 
} from '@/lib/invoiceTemplates';
import { formatCurrency, currencies } from '@/lib/numberToWords';

interface Client {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  siret: string | null;
  vat_number: string | null;
}

interface InvoiceItem {
  id?: string;
  reference: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string | null;
  issue_date: string;
  due_date: string;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  currency: string;
  template_type: string;
  created_by_user_id: string | null;
  clients?: Client;
  stamp_included?: boolean;
  stamp_amount?: number;
}

interface CompanySettings {
  company_name: string | null;
  company_address: string | null;
  company_city: string | null;
  company_postal_code: string | null;
  company_country: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_vat_number: string | null;
  company_tax_id: string | null;
  company_trade_register: string | null;
  company_logo_url: string | null;
  activity: string | null;
  default_currency: string | null;
  default_vat_rate: number | null;
  signature_url: string | null;
  stamp_url: string | null;
}

interface UserProfile {
  full_name: string | null;
}

interface UserRole {
  role: string;
}

import { InvoiceStatus } from '@/lib/documentStatus';

const statusColors: Record<string, string> = {
  [InvoiceStatus.DRAFT]: 'bg-muted text-muted-foreground',
  [InvoiceStatus.PURCHASE_QUOTE]: 'bg-muted text-muted-foreground',
  [InvoiceStatus.SENT]: 'bg-blue-100 text-blue-800',
  [InvoiceStatus.PAID]: 'bg-green-100 text-green-800',
  [InvoiceStatus.OVERDUE]: 'bg-red-100 text-red-800',
  [InvoiceStatus.CANCELLED]: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, string> = {
  [InvoiceStatus.DRAFT]: 'Brouillon',
  [InvoiceStatus.PURCHASE_QUOTE]: 'Devis d\'achat',
  [InvoiceStatus.PAID]: 'Payée',
  [InvoiceStatus.OVERDUE]: 'En retard',
  [InvoiceStatus.CANCELLED]: 'Annulée',
};

const roleLabels: Record<string, string> = {
  admin: 'Administrateur',
  comptable: 'Comptable',
  gerant: 'Gérant',
  caissier: 'Caissier',
};

export default function Invoices() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<{id:string; name:string; sku:string; quantity:number; min_stock:number; sale_price:number|null; unit_price:number; description:string|null; unit:string|null; vat_rate:number|null}[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<string>('cashier');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<InvoiceItem[]>([]);
  
  const [formData, setFormData] = useState<{
    client_id: string;
    issue_date: string;
    due_date: string;
    stamp_included: boolean;
    notes: string;
    status: string;
    currency: string;
    template_type: TemplateType;
  }>({
    client_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    stamp_included: false,
    notes: '',
    status: InvoiceStatus.DRAFT,
    currency: 'TND',
    template_type: 'classic' as TemplateType,
  });
  const [items, setItems] = useState<InvoiceItem[]>([{ reference: '', description: '', quantity: 1, unit_price: 0, vat_rate: 0, vat_amount: 0, total: 0 }]);
  const [itemProductMap, setItemProductMap] = useState<Record<number, string>>({});
  const [manualLines, setManualLines] = useState<Record<number, boolean>>({});
  const [documentType, setDocumentType] = useState<'sale' | 'purchase'>('sale');
  const [openProductPopover, setOpenProductPopover] = useState<number | null>(null);
  const canExport = canExportData(role ?? 'cashier');

  useEffect(() => {
    if (user) {
      fetchInvoices();
      fetchClients();
      fetchProducts();
      fetchCompanySettings();
      fetchUserInfo();
    }
  }, [user]);

  const fetchInvoices = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, clients(*)')
      .order('created_at', { ascending: false });
    
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      setInvoices((data || []).map(inv => ({
        ...inv,
        currency: inv.currency || 'TND',
        template_type: inv.template_type || 'classic',
      })));
    }
    setLoading(false);
  };

  const onExportCSV = async () => {
    if (!canExport) {
      toast({ variant: 'destructive', title: 'Permission refusée', description: 'Vous n’avez pas l’autorisation d’exporter ces données.' });
      return;
    }
    try {
      // Try server-side enforced export first
      await exportServerCSV('invoices');
      toast({ title: 'Export serveur', description: 'Le téléchargement va démarrer.' });
    } catch (e: any) {
      // Fallback to client-side
      try {
        const rows = mapInvoicesToCSV(invoices);
        downloadCSV('factures', rows);
        toast({ title: 'Export CSV (local)', description: `${rows.length} ligne(s)` });
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Erreur', description: err?.message || 'Échec export CSV' });
      }
    }
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('name');
    setClients(data || []);
  };

  const fetchCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('company_name, company_address, company_city, company_postal_code, company_country, company_phone, company_email, company_vat_number, company_tax_id, company_trade_register, company_logo_url, activity, default_currency, default_vat_rate, signature_url, stamp_url')
      .eq('user_id', user?.id)
      .maybeSingle();
    
    if (data) {
      setCompanySettings(data);
      // Apply default settings to form
      setFormData(prev => ({
        ...prev,
        currency: data.default_currency || 'TND',
      }));
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('id,name,sku,quantity,min_stock,sale_price,unit_price,description,unit,vat_rate').order('name');
    if (!error) setProducts(data || []);
  };

  const handleProductSelect = (index: number, productId: string) => {
    setItemProductMap(prev => ({ ...prev, [index]: productId }));
    setManualLines(prev => ({ ...prev, [index]: false }));
    const product = products.find(p => p.id === productId);
    if (product) {
      const newItems = [...items];
      const price = Number(product.sale_price) || Number(product.unit_price) || 0;
      const vatRate = Number(product.vat_rate) || 0;
      const lineTotal = newItems[index].quantity * price;
      const vatAmount = lineTotal * (vatRate / 100);
      newItems[index] = {
        ...newItems[index],
        reference: product.sku || '',
        description: product.name + (product.description ? ` - ${product.description}` : ''),
        unit_price: price,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        total: lineTotal,
      };
      setItems(newItems);
    }
  };

  const handleManualEntry = (index: number) => {
  setManualLines((prev) => ({ ...prev, [index]: true }));

  setItemProductMap((prev) => {
    const newMap = { ...prev };
    delete newMap[index];
    return newMap;
  });

  const newItems = [...items];

  // Ensure manual line has something valid to submit
  newItems[index] = {
    ...newItems[index],
    reference: newItems[index].reference || 'MANUAL',
    description: newItems[index].description || '',
    quantity: Number(newItems[index].quantity || 1),
    unit_price: Number(newItems[index].unit_price || 0),
    vat_rate: Number(newItems[index].vat_rate ?? companySettings?.default_vat_rate ?? 19),
  };

  // Recompute totals
  const lineTotal = newItems[index].quantity * newItems[index].unit_price;
  const vatAmount = lineTotal * (newItems[index].vat_rate / 100);
  newItems[index].total = lineTotal;
  newItems[index].vat_amount = vatAmount;

  setItems(newItems);
};


  const fetchUserInfo = async () => {
    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user?.id)
      .maybeSingle();
    
    if (profileData) {
      setUserProfile(profileData);
    }

    // Fetch role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user?.id)
      .maybeSingle();
    
    if (roleData) {
      setUserRole(roleData.role);
    }
  };

  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `FAC-${year}${month}-${random}`;
  };

  const STAMP_AMOUNT = 1; // TND
  const calculateTotals = (invoiceItems: InvoiceItem[], stampIncluded: boolean) => {
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = invoiceItems.reduce((sum, item) => sum + item.vat_amount, 0);
    const stamp = stampIncluded ? STAMP_AMOUNT : 0;
    const total = subtotal + taxAmount + stamp;
    return { subtotal, taxAmount, stamp, total };
  };

  const updateItemTotal = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price' || field === 'vat_rate') {
      const lineTotal = newItems[index].quantity * newItems[index].unit_price;
      const vatAmount = lineTotal * (newItems[index].vat_rate / 100);
      newItems[index].total = lineTotal;
      newItems[index].vat_amount = vatAmount;
    }
    setItems(newItems);
  };

  const addItem = () => {
    const newIndex = items.length;
    setItems([...items, { reference: '', description: '', quantity: 1, unit_price: 0, vat_rate: companySettings?.default_vat_rate || 19, vat_amount: 0, total: 0 }]);
    // New lines are manual by default
    setManualLines(prev => ({ ...prev, [newIndex]: true }));
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { subtotal, taxAmount, stamp, total } = calculateTotals(items, formData.stamp_included);
    const invoiceNumber = generateInvoiceNumber();

    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id: user?.id,
        client_id: formData.client_id || null,
        invoice_number: invoiceNumber,
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        status: formData.status,
        subtotal,
        tax_rate: 0, // Per-item TVA now
        tax_amount: taxAmount,
        total,
        stamp_included: formData.stamp_included,
        stamp_amount: stamp,
        notes: formData.notes || null,
        currency: formData.currency,
        template_type: formData.template_type,
        created_by_user_id: user?.id,
      })
      .select()
      .single();

    if (invoiceError) {
      toast({ variant: 'destructive', title: 'Erreur', description: invoiceError.message });
      return;
    }

    // If this is a purchase quote, we do not generate stock movements or further processing
    if (formData.status === InvoiceStatus.PURCHASE_QUOTE) {
      toast({ title: 'Devis d\'achat enregistré', description: 'Les mouvements de stock ne sont pas générés pour un Devis d\'achat.' });
      await fetchInvoices();
      closeDialog();
      return;
    }

    const invoiceItems = items.map(item => ({
      invoice_id: invoiceData.id,
      reference: item.reference,
      description: item.description || '',
      quantity: item.quantity,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
      vat_amount: item.vat_amount,
      total: item.total,
    }));

    const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItems);

    if (itemsError) {
      toast({ variant: 'destructive', title: 'Erreur', description: itemsError.message });
    } else {
      toast({ title: 'Succès', description: 'Facture créée' });
      // Auto-création des mouvements de stock selon type document (vente → sortie, achat → entrée)
      try {
        // Aggregate quantities per product_id before creating movements
        const movementMap: Record<string, number> = {};
        items.forEach((item, idx) => {
          const pid = itemProductMap[idx]
          if (!pid) return
          const q = Number(item.quantity || 0)
          movementMap[pid] = (movementMap[pid] || 0) + q
        })

        const selectedMovements = Object.entries(movementMap).map(([productid, quantity]) => ({
          productid,
          quantity,
        }))

        console.debug("invoice aggregated movements", selectedMovements)

        if (selectedMovements.length > 0) {
          // Fetch current stock for involved products
          const ids = selectedMovements.map((m) => m.productid)

          const { data: prodData, error: prodErr } = await supabase
            .from("products")
            .select("id,quantity,min_stock")
            .in("id", ids)

          if (prodErr) throw prodErr

          const prodMap: Record<string, any> = Object.fromEntries((prodData || []).map((p: any) => [p.id, p]))

          // Check stock availability ONLY for sale (exit)
          const insufficient =
            documentType === "sale"
              ? selectedMovements.filter((m) => {
                  const available = Number(prodMap[m.productid]?.quantity ?? 0)
                  return available < Number(m.quantity)
                })
              : []

          if (insufficient.length > 0) {
            toast({
              variant: "destructive",
              title: "Stock insuffisant",
              description: `${insufficient.length} produits dépassent le stock disponible.`,
            })
          } else {
            // 1) Update products.quantity (subtract for sale, add for purchase)
            for (const m of selectedMovements) {
              const currentQty = Number(prodMap[m.productid]?.quantity ?? 0)
              const q = Number(m.quantity ?? 0)

              const newQty = documentType === "sale" ? currentQty - q : currentQty + q

              const { error: updErr } = await supabase
                .from("products")
                .update({ quantity: newQty })
                .eq("id", m.productid)

              if (updErr) throw updErr
            }

            // 2) Insert stock movements
            const inserts = selectedMovements.map((m) => ({
              user_id: user?.id,
              product_id: m.productid,
              movement_type: documentType === "sale" ? "exit" : "entry",
              quantity: Number(m.quantity),
              note: `Facture ${invoiceNumber}`,
            }))

            const { error: movErr } = await supabase.from("stock_movements").insert(inserts)

            if (movErr) {
              toast({
                variant: "destructive",
                title: "Erreur",
                description: movErr.message,
              })
            } else {
              // Re-fetch to compute low-stock warnings based on updated quantities
              const { data: updated, error: updFetchErr } = await supabase
                .from("products")
                .select("id,quantity,min_stock")
                .in("id", ids)

              if (!updFetchErr && updated) {
                const low = updated.filter((p: any) => Number(p.quantity) <= Number(p.min_stock))
                if (low.length > 0) {
                  toast({
                    title: "Stock faible",
                    description: `${low.length} produits ont atteint un niveau bas après la facture.`,
                  })
                }
              }

              toast({
                title: "Succès",
                description: `Mouvements de stock générés (${documentType === "sale" ? "sorties" : "entrées"}).`,
              })
            }
          }
        }

      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Erreur', description: err?.message || 'Problème lors de la génération des mouvements de stock' });
      } finally {
        setSubmitting(false);
      }
      // Refresh products to show updated stock quantities
      await fetchProducts();
      fetchInvoices();
      closeDialog();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette facture ?')) return;
    
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      toast({ title: 'Succès', description: 'Facture supprimée' });
      fetchInvoices();
    }
  };

  const handleConvertQuote = async (invoiceId: string) => {
    if (!invoiceId) return;
    try {
      const { data, error } = await supabase.rpc('convert_purchase_quote_to_invoice', { p_invoice_id: invoiceId });
      if (error) throw error;
      toast({ title: 'Devis converti', description: 'Le devis a été converti en facture.' });
      await fetchInvoices();
      setViewDialogOpen(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err?.message || 'Impossible de convertir le devis.' });
    }
  };

  const viewInvoice = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    const { data } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id);
    setSelectedInvoiceItems(data || []);
    setViewDialogOpen(true);
  };

  const downloadPDF = async (invoice: Invoice) => {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id);
    
    // Get creator info if available
    let creatorName = userProfile?.full_name || user?.email || 'Utilisateur';
    let creatorRole = roleLabels[userRole] || 'Utilisateur';
    
    const invoiceData: InvoiceTemplateData = {
      invoice_number: invoice.invoice_number,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      subtotal: Number(invoice.subtotal),
      tax_rate: Number(invoice.tax_rate),
      tax_amount: Number(invoice.tax_amount),
      total: Number(invoice.total),
      stamp_included: Boolean(invoice.stamp_included),
      stamp_amount: Number(invoice.stamp_amount || 0),
      notes: invoice.notes || undefined,
      currency: invoice.currency || 'TND',
      template_type: invoice.template_type || 'classic',
      client: invoice.clients ? {
        name: invoice.clients.name,
        address: invoice.clients.address || undefined,
        city: invoice.clients.city || undefined,
        postal_code: invoice.clients.postal_code || undefined,
        email: invoice.clients.email || undefined,
        siret: invoice.clients.siret || undefined,
        vat_number: invoice.clients.vat_number || undefined,
      } : undefined,
      company: companySettings ? {
        name: companySettings.company_name || undefined,
        address: companySettings.company_address || undefined,
        city: companySettings.company_city || undefined,
        postal_code: companySettings.company_postal_code || undefined,
        country: companySettings.company_country || undefined,
        phone: companySettings.company_phone || undefined,
        email: companySettings.company_email || undefined,
        vat_number: companySettings.company_vat_number || undefined,
        tax_id: companySettings.company_tax_id || undefined,
        trade_register: companySettings.company_trade_register || undefined,
        logo_url: companySettings.company_logo_url || undefined,
        activity: companySettings.activity || undefined,
        signature_url: companySettings.signature_url || undefined,
        stamp_url: companySettings.stamp_url || undefined,
      } : undefined,
      created_by: {
        name: creatorName,
        role: creatorRole,
        created_at: new Date().toISOString(),
      },
    };
    
    const mapped = (items || []).map((i: any) => {
      const reference = String(i.reference) || '';
      const quantity = Number(i.quantity) || 0;
      const unit_price = Number(i.unit_price) || 0;
      const total = Number(i.total) || (quantity * unit_price);
      const vat_rate = i.vat_rate !== undefined && i.vat_rate !== null ? Number(i.vat_rate) : (invoice.tax_rate ?? 0);
      const vat_amount = i.vat_amount !== undefined && i.vat_amount !== null ? Number(i.vat_amount) : (total * (Number(vat_rate) / 100));
      return {
        reference,
        description: i.description,
        quantity,
        unit_price,
        total,
        vat_rate: Number(vat_rate) || 0,
        vat_amount: Number(vat_amount) || 0,
      };
    });

    await generateInvoiceWithTemplate(invoiceData, mapped);
  };

  /**
   * Print the invoice PDF using openPdfForPrint.
   * - Generates the PDF in memory as a Blob.
   * - Loads it in a hidden iframe and triggers the native print dialog.
   * - No file download is triggered.
   */
  const printPDF = async (invoice: Invoice) => {
    try {
      const { data: items } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id);

      let creatorName = userProfile?.full_name || user?.email || 'Utilisateur';
      let creatorRole = roleLabels[userRole] || 'Utilisateur';

      const invoiceData: InvoiceTemplateData = {
        invoice_number: invoice.invoice_number,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        subtotal: Number(invoice.subtotal),
        tax_rate: Number(invoice.tax_rate),
        tax_amount: Number(invoice.tax_amount),
        total: Number(invoice.total),
        stamp_included: Boolean(invoice.stamp_included),
        stamp_amount: Number(invoice.stamp_amount || 0),
        notes: invoice.notes || undefined,
        currency: invoice.currency || 'TND',
        template_type: invoice.template_type || 'classic',
        client: invoice.clients ? {
          name: invoice.clients.name,
          address: invoice.clients.address || undefined,
          city: invoice.clients.city || undefined,
          postal_code: invoice.clients.postal_code || undefined,
          email: invoice.clients.email || undefined,
          siret: invoice.clients.siret || undefined,
          vat_number: invoice.clients.vat_number || undefined,
        } : undefined,
        company: companySettings ? {
          name: companySettings.company_name || undefined,
          address: companySettings.company_address || undefined,
          city: companySettings.company_city || undefined,
          postal_code: companySettings.company_postal_code || undefined,
          country: companySettings.company_country || undefined,
          phone: companySettings.company_phone || undefined,
          email: companySettings.company_email || undefined,
          vat_number: companySettings.company_vat_number || undefined,
          tax_id: companySettings.company_tax_id || undefined,
          trade_register: companySettings.company_trade_register || undefined,
          logo_url: companySettings.company_logo_url || undefined,
          activity: companySettings.activity || undefined,
          signature_url: companySettings.signature_url || undefined,
          stamp_url: companySettings.stamp_url || undefined,
        } : undefined,
        created_by: {
          name: creatorName,
          role: creatorRole,
          created_at: new Date().toISOString(),
        },
      };

      // Generate the PDF as a Blob (in memory, no download)
      const jsPDF = (await import('jspdf')).jsPDF;
      const doc = new jsPDF();
      // ...generate the invoice content using your template logic...
      // For simplicity, use the classic template (adapt as needed)
      // You may want to refactor your template logic to accept a jsPDF instance and return a Blob
      // Here, we use doc.output('blob')
      // (You may need to refactor generateInvoiceWithTemplate to support this)
      // For now, just a placeholder:
      // await generateInvoiceWithTemplate(invoiceData, items || [], doc);
      // const pdfBlob = doc.output('blob');

      // --- BEGIN: Minimal PDF generation for print ---
      doc.setFontSize(24);
      doc.text('FACTURE', 20, 30);
      doc.setFontSize(12);
      doc.text(`N° ${invoice.invoice_number}`, 20, 40);
      // ...add more invoice details as needed...
      // --- END: Minimal PDF generation for print ---

      const pdfBlob = doc.output('blob');
      await openPdfForPrint(pdfBlob);
    } catch (e: unknown) {
      const error = e as Error;
      toast({ variant: 'destructive', title: 'Erreur', description: error?.message || 'Impossible d\'imprimer le PDF.' });
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setFormData({
      client_id: '',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      stamp_included: false,
      notes: '',
      status: InvoiceStatus.DRAFT,
      currency: companySettings?.default_currency || 'TND',
      template_type: 'classic' as TemplateType,
    });
    setItems([{ reference: '', description: '', quantity: 1, unit_price: 0, vat_rate: 0, vat_amount: 0, total: 0 }]);
  };

  const filteredInvoices = invoices.filter(i =>
    i.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    i.clients?.name.toLowerCase().includes(search.toLowerCase())
  );

  const { subtotal, taxAmount, stamp, total } = calculateTotals(items, formData.stamp_included);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Factures</h1>
          <p className="text-muted-foreground">Gérez vos factures</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nouvelle facture</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouvelle facture</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Template selection */}
              <div className="space-y-3">
                <Label>Modèle de facture</Label>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(templateLabels) as TemplateType[]).map((template) => (
                    <div
                      key={template}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        formData.template_type === template
                          ? 'border-primary bg-primary/5 ring-2 ring-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setFormData({ ...formData, template_type: template })}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <span className="font-medium">{templateLabels[template]}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{templateDescriptions[template]}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                  <Label>Statut</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={InvoiceStatus.DRAFT}>Brouillon</SelectItem>
                      <SelectItem value={InvoiceStatus.PURCHASE_QUOTE}>Devis d'achat</SelectItem>
                      <SelectItem value="paid">Payée</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Client</Label>
                  <Select value={formData.client_id || 'none'} onValueChange={v => setFormData({ ...formData, client_id: v === 'none' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun client</SelectItem>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
               
                <div>
                  <Label>Date d'émission</Label>
                  <Input
                    type="date"
                    value={formData.issue_date}
                    onChange={e => setFormData({ ...formData, issue_date: e.target.value })}
                    disabled={formData.status === InvoiceStatus.PURCHASE_QUOTE || formData.status === InvoiceStatus.DRAFT}
                    title={formData.status === InvoiceStatus.PURCHASE_QUOTE ? "Désactivé pour un Devis d'achat" : undefined}
                  />
                </div>
                <div>
                  <Label>Date d'échéance</Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                    disabled={formData.status === InvoiceStatus.PURCHASE_QUOTE || formData.status === InvoiceStatus.DRAFT}
                    title={formData.status === InvoiceStatus.PURCHASE_QUOTE ? "Désactivé pour un Devis d'achat" : undefined}
                  />
                </div>
                <div>
                  <Label>Devise</Label>
                  <Select value={formData.currency} onValueChange={v => setFormData({ ...formData, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(currencies).map(([code, info]) => (
                        <SelectItem key={code} value={code}>
                          {info.symbol} {code} - {info.name.charAt(0).toUpperCase() + info.name.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* <div >
                  <Label>Type de facture</Label>
                  <div className="items-center">
                       <UiSelect value={documentType} onValueChange={(v) => setDocumentType(v as 'sale' | 'purchase')}>
                      <UiSelectTrigger className="col-span-4">
                        <UiSelectValue placeholder="Type de document" />
                      </UiSelectTrigger>
                      <UiSelectContent>
                        <UiSelectItem value="sale">Vente</UiSelectItem>
                        <UiSelectItem value="purchase">Achat</UiSelectItem>
                      </UiSelectContent>
                    </UiSelect>
                  </div>
                   
                </div> */}
                <div>
                  <Label>Timbre fiscal</Label>
                  <div className="col-span-2 flex items-center gap-2 pt-2">
                    <input id="stamp" type="checkbox" className="h-4 w-4" checked={formData.stamp_included} onChange={e => setFormData({ ...formData, stamp_included: e.target.checked })} />
                    <Label htmlFor="stamp">Inclure le timbre fiscal (1 TND)</Label>
                  </div>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Lignes de facture</Label>
                <div className="space-y-2">
                  
                  {/* Header row */}
                  <div className="grid grid-cols-12 gap-2 items-center font-medium text-sm text-muted-foreground border-b pb-2">
                    <span className="col-span-3">Produit</span>
                    <span className="col-span-3">Description</span>
                    <span className="col-span-1">Qté</span>
                    <span className="col-span-2">Prix U.</span>
                    <span className="col-span-1">TVA %</span>
                    <span className="col-span-1 text-right">Total HT</span>
                    <span className="col-span-1"></span>
                  </div>
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <Popover 
                        open={openProductPopover === index} 
                        onOpenChange={(open) => setOpenProductPopover(open ? index : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="col-span-3 justify-between font-normal"
                          >
                            <span className="truncate">
                              {manualLines[index] 
                                ? "📝 Saisie manuelle"
                                : itemProductMap[index] 
                                  ? products.find(p => p.id === itemProductMap[index])?.name 
                                  : "Rechercher..."}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Tapez pour rechercher..." />
                            <CommandList>
                              <CommandEmpty>Aucun produit trouvé.</CommandEmpty>
                              <CommandGroup heading="Options">
                                <CommandItem
                                  value="__manual__"
                                  onSelect={() => {
                                    handleManualEntry(index);
                                    setOpenProductPopover(null);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      manualLines[index] ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span>📝 Saisie manuelle</span>
                                    <span className="text-xs text-muted-foreground">
                                      Produit non référencé en stock
                                    </span>
                                  </div>
                                </CommandItem>
                              </CommandGroup>
                              <CommandGroup heading="Produits en stock">
                                {products.map(product => (
                                  <CommandItem
                                    key={product.id}
                                    value={`${product.name} ${product.sku || ''}`}
                                    onSelect={() => {
                                      handleProductSelect(index, product.id);
                                      setOpenProductPopover(null);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        itemProductMap[index] === product.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span>{product.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {product.sku ? `SKU: ${product.sku} — ` : ''}Stock: {product.quantity}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <Input
                        placeholder="Description"
                        className="col-span-3"
                        value={item.description}
                        onChange={e => updateItemTotal(index, 'description', e.target.value)}
                      />
                      <Input
                        type="number"
                        placeholder="Qté"
                        className="col-span-1"
                        value={item.quantity}
                        onChange={e => updateItemTotal(index, 'quantity', Number(e.target.value))}
                        min={1}
                      />
                      <Input
                        type="number"
                        placeholder="Prix"
                        className="col-span-2"
                        value={item.unit_price}
                        onChange={e => updateItemTotal(index, 'unit_price', Number(e.target.value))}
                        step="0.01"
                      />
                      <Input
                        type="number"
                        placeholder="TVA"
                        className="col-span-1"
                        value={item.vat_rate}
                        onChange={e => updateItemTotal(index, 'vat_rate', Number(e.target.value))}
                        min={0}
                        step="0.1"
                      />
                      <div className="col-span-1 text-right font-medium text-sm">
                        {formatCurrency(item.total, formData.currency)}
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="col-span-1">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="mt-2">
                  <Plus className="h-4 w-4 mr-1" />Ajouter une ligne
                </Button>
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-1 text-right">
                <p>Sous-total HT: <span className="font-medium">{formatCurrency(subtotal, formData.currency)}</span></p>
                <p>Montant TVA: <span className="font-medium">{formatCurrency(taxAmount, formData.currency)}</span></p>
                {formData.stamp_included && (
                  <p>Timbre fiscal: <span className="font-medium">{formatCurrency(stamp, formData.currency)}</span></p>
                )}
                <p className="text-lg font-bold">Total TTC: {formatCurrency(total, formData.currency)}</p>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                {submitting ? 'Création...' : 'Créer la facture'}
              </Button>

            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="relative flex items-center gap-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
            {canExport && (
              <Button variant="outline" onClick={onExportCSV}><Download className="h-4 w-4" /> Exporter</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Devise</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Aucune facture</TableCell></TableRow>
              ) : (
                filteredInvoices.map(invoice => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.clients?.name || '-'}</TableCell>
                    <TableCell>{new Date(invoice.issue_date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[invoice.status]}>{statusLabels[invoice.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{invoice.currency}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(invoice.total), invoice.currency)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => viewInvoice(invoice)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => downloadPDF(invoice)}><Download className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => printPDF(invoice)} title="Imprimer"><Printer className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(invoice.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Facture {selectedInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Client</p>
                  <p className="font-medium">{selectedInvoice.clients?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Statut</p>
                  <Badge className={statusColors[selectedInvoice.status]}>{statusLabels[selectedInvoice.status]}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Date d'émission</p>
                  <p className="font-medium">{new Date(selectedInvoice.issue_date).toLocaleDateString('fr-FR')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date d'échéance</p>
                  <p className="font-medium">{new Date(selectedInvoice.due_date).toLocaleDateString('fr-FR')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Devise</p>
                  <p className="font-medium">{selectedInvoice.currency}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Modèle</p>
                  <p className="font-medium">{templateLabels[selectedInvoice.template_type as TemplateType] || 'Classique'}</p>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground mb-2">Articles</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Qté</TableHead>
                      <TableHead>Prix unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoiceItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{formatCurrency(Number(item.unit_price), selectedInvoice.currency)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(item.total), selectedInvoice.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-1 text-right">
                <p>Sous-total HT: <span className="font-medium">{formatCurrency(Number(selectedInvoice.subtotal), selectedInvoice.currency)}</span></p>
                <p>TVA ({selectedInvoice.tax_rate}%): <span className="font-medium">{formatCurrency(Number(selectedInvoice.tax_amount), selectedInvoice.currency)}</span></p>
                {selectedInvoice.stamp_included && (
                  <p>Timbre fiscal: <span className="font-medium">{formatCurrency(Number(selectedInvoice.stamp_amount || 0), selectedInvoice.currency)}</span></p>
                )}
                <p className="text-lg font-bold">Total TTC: {formatCurrency(Number(selectedInvoice.total), selectedInvoice.currency)}</p>
              </div>

              {selectedInvoice.notes && (
                <div>
                  <p className="text-muted-foreground">Notes</p>
                  <p className="text-sm">{selectedInvoice.notes}</p>
                </div>
              )}

              <Button onClick={() => downloadPDF(selectedInvoice)} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Télécharger le PDF
              </Button>
              {selectedInvoice?.status === InvoiceStatus.PURCHASE_QUOTE && (role === 'admin' || role === 'accountant') && (
                <Button onClick={() => handleConvertQuote(selectedInvoice.id)} className="w-full mt-2">
                  Convertir en facture d'achat
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
