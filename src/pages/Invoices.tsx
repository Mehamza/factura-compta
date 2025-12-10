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
import { Plus, Search, Download, Trash2, Eye } from 'lucide-react';
import { generateInvoicePDF } from '@/lib/generateInvoicePDF';

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
  description: string;
  quantity: number;
  unit_price: number;
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
  clients?: Client;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulée',
};

export default function Invoices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<InvoiceItem[]>([]);
  
  const [formData, setFormData] = useState({
    client_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    tax_rate: 20,
    notes: '',
    status: 'draft',
  });
  const [items, setItems] = useState<InvoiceItem[]>([{ description: '', quantity: 1, unit_price: 0, total: 0 }]);

  useEffect(() => {
    if (user) {
      fetchInvoices();
      fetchClients();
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
      setInvoices(data || []);
    }
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('name');
    setClients(data || []);
  };

  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `FAC-${year}${month}-${random}`;
  };

  const calculateTotals = (invoiceItems: InvoiceItem[], taxRate: number) => {
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const updateItemTotal = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total = newItems[index].quantity * newItems[index].unit_price;
    }
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { subtotal, taxAmount, total } = calculateTotals(items, formData.tax_rate);
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
        tax_rate: formData.tax_rate,
        tax_amount: taxAmount,
        total,
        notes: formData.notes || null,
      })
      .select()
      .single();

    if (invoiceError) {
      toast({ variant: 'destructive', title: 'Erreur', description: invoiceError.message });
      return;
    }

    const invoiceItems = items.map(item => ({
      invoice_id: invoiceData.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
    }));

    const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItems);

    if (itemsError) {
      toast({ variant: 'destructive', title: 'Erreur', description: itemsError.message });
    } else {
      toast({ title: 'Succès', description: 'Facture créée' });
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
    
    generateInvoicePDF(
      {
        invoice_number: invoice.invoice_number,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        subtotal: Number(invoice.subtotal),
        tax_rate: Number(invoice.tax_rate),
        tax_amount: Number(invoice.tax_amount),
        total: Number(invoice.total),
        notes: invoice.notes || undefined,
        client: invoice.clients ? {
          name: invoice.clients.name,
          address: invoice.clients.address || undefined,
          city: invoice.clients.city || undefined,
          postal_code: invoice.clients.postal_code || undefined,
          email: invoice.clients.email || undefined,
          siret: invoice.clients.siret || undefined,
          vat_number: invoice.clients.vat_number || undefined,
        } : undefined,
      },
      (items || []).map(i => ({
        description: i.description,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        total: Number(i.total),
      }))
    );
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setFormData({
      client_id: '',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      tax_rate: 20,
      notes: '',
      status: 'draft',
    });
    setItems([{ description: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const filteredInvoices = invoices.filter(i =>
    i.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    i.clients?.name.toLowerCase().includes(search.toLowerCase())
  );

  const { subtotal, taxAmount, total } = calculateTotals(items, formData.tax_rate);

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
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouvelle facture</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Client</Label>
                  <Select value={formData.client_id} onValueChange={v => setFormData({ ...formData, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Statut</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="sent">Envoyée</SelectItem>
                      <SelectItem value="paid">Payée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date d'émission</Label>
                  <Input type="date" value={formData.issue_date} onChange={e => setFormData({ ...formData, issue_date: e.target.value })} />
                </div>
                <div>
                  <Label>Date d'échéance</Label>
                  <Input type="date" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} />
                </div>
                <div>
                  <Label>Taux TVA (%)</Label>
                  <Input type="number" value={formData.tax_rate} onChange={e => setFormData({ ...formData, tax_rate: Number(e.target.value) })} />
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Lignes de facture</Label>
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <Input
                        placeholder="Description"
                        className="col-span-5"
                        value={item.description}
                        onChange={e => updateItemTotal(index, 'description', e.target.value)}
                        required
                      />
                      <Input
                        type="number"
                        placeholder="Qté"
                        className="col-span-2"
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
                      <div className="col-span-2 text-right font-medium">{item.total.toFixed(2)} €</div>
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
                <p>Sous-total HT: <span className="font-medium">{subtotal.toFixed(2)} €</span></p>
                <p>TVA ({formData.tax_rate}%): <span className="font-medium">{taxAmount.toFixed(2)} €</span></p>
                <p className="text-lg font-bold">Total TTC: {total.toFixed(2)} €</p>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>

              <Button type="submit" className="w-full">Créer la facture</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
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
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Aucune facture</TableCell></TableRow>
              ) : (
                filteredInvoices.map(invoice => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.clients?.name || '-'}</TableCell>
                    <TableCell>{new Date(invoice.issue_date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[invoice.status]}>{statusLabels[invoice.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{Number(invoice.total).toFixed(2)} €</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => viewInvoice(invoice)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => downloadPDF(invoice)}><Download className="h-4 w-4" /></Button>
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
              </div>
              
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
                  {selectedInvoiceItems.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{Number(item.unit_price).toFixed(2)} €</TableCell>
                      <TableCell className="text-right">{Number(item.total).toFixed(2)} €</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <div className="bg-muted p-4 rounded-lg space-y-1 text-right">
                <p>Sous-total HT: <span className="font-medium">{Number(selectedInvoice.subtotal).toFixed(2)} €</span></p>
                <p>TVA ({selectedInvoice.tax_rate}%): <span className="font-medium">{Number(selectedInvoice.tax_amount).toFixed(2)} €</span></p>
                <p className="text-lg font-bold">Total TTC: {Number(selectedInvoice.total).toFixed(2)} €</p>
              </div>
              
              <Button className="w-full" onClick={() => downloadPDF(selectedInvoice)}>
                <Download className="h-4 w-4 mr-2" />Télécharger PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
