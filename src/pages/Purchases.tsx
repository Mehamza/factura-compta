import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySettings } from '@/hooks/useCompanySettings';
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
import { downloadCSV } from '@/lib/export';
import { canExportData } from '@/lib/permissions';
import { Plus, Search, Download, Trash2, Eye, FileText } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/numberToWords';

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  siret: string | null;
  vat_number: string | null;
}

interface PurchaseItem {
  id?: string;
  reference: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
}

interface Purchase {
  id: string;
  purchase_number: string;
  supplier_id: string | null;
  issue_date: string;
  due_date: string;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  currency: string;
  suppliers?: Supplier;
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
  sent: 'Envoyé',
  paid: 'Payé',
  overdue: 'En retard',
  cancelled: 'Annulé',
};

export default function Purchases() {
  const { user, role, activeCompanyId } = useAuth();
  const { companySettings } = useCompanySettings();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<{id:string; name:string; sku:string; quantity:number; purchase_price:number|null; description:string|null; unit:string|null; vat_rate:number|null}[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [selectedPurchaseItems, setSelectedPurchaseItems] = useState<PurchaseItem[]>([]);
  
  const [formData, setFormData] = useState<{
    supplier_id: string;
    issue_date: string;
    due_date: string;
    notes: string;
    status: string;
    currency: string;
  }>({
    supplier_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
    status: 'draft',
    currency: 'TND',
  });
  
  const [items, setItems] = useState<PurchaseItem[]>([
    { reference: '', description: '', quantity: 1, unit_price: 0, vat_rate: 19, vat_amount: 0, total: 0 }
  ]);
  
  const [itemProductMap, setItemProductMap] = useState<Record<number, string>>({});
  const [openProductPopover, setOpenProductPopover] = useState<number | null>(null);
  const canExport = canExportData(role ?? 'cashier');

  useEffect(() => {
    if (user && activeCompanyId) {
      fetchPurchases();
      fetchSuppliers();
      fetchProducts();
    }
  }, [user, activeCompanyId]);

  // Apply company settings defaults
  useEffect(() => {
    if (companySettings?.default_currency) {
      setFormData(prev => ({
        ...prev,
        currency: companySettings.default_currency || 'TND',
      }));
    }
  }, [companySettings]);

  const fetchPurchases = async () => {
    // For now, we'll use the invoices table with a filter or create a separate purchases table
    // This is a placeholder - you may want to create a separate purchases table
    const { data, error } = await supabase
      .from('invoices')
      .select('*, suppliers:client_id(*)')
      .eq('document_type', 'purchase')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.log('No purchases found or error:', error);
      setPurchases([]);
    } else {
      setPurchases((data || []) as any);
    }
    setLoading(false);
  };

  const fetchSuppliers = async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', activeCompanyId)
      .order('name');
    
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      setSuppliers(data || []);
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, quantity, purchase_price, description, unit, vat_rate')
      .eq('company_id', activeCompanyId)
      .order('name');
    
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      setProducts(data || []);
    }
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax_amount = items.reduce((sum, item) => sum + item.vat_amount, 0);
    const total = subtotal + tax_amount;
    const tax_rate = subtotal > 0 ? (tax_amount / subtotal) * 100 : 0;
    return { subtotal, tax_rate, tax_amount, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Aucune entreprise active' });
      return;
    }

    setSubmitting(true);
    
    const { subtotal, tax_rate, tax_amount, total } = calculateTotals();

    try {
      // Generate purchase number
      const count = purchases.length + 1;
      const purchase_number = `ACH-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

      const purchaseData = {
        purchase_number,
        company_id: activeCompanyId,
        supplier_id: formData.supplier_id || null,
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        status: formData.status,
        subtotal,
        tax_rate,
        tax_amount,
        total,
        notes: formData.notes,
        currency: formData.currency,
        document_type: 'purchase',
        created_by_user_id: user?.id,
      };

      // Insert into invoices table with document_type = 'purchase'
      const { data, error } = await supabase
        .from('invoices')
        .insert([purchaseData as any])
        .select()
        .single();

      if (error) throw error;

      // Insert purchase items
      const purchaseItems = items.map(item => ({
        invoice_id: data.id,
        company_id: activeCompanyId,
        reference: item.reference,
        description: item.description || '',
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate,
        vat_amount: item.vat_amount,
        total: item.total,
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(purchaseItems);

      if (itemsError) {
        toast({ variant: 'destructive', title: 'Erreur', description: itemsError.message });
      } else {
        toast({ title: 'Succès', description: 'Achat créé avec succès' });
        
        // Update stock for purchases (increase quantity)
        for (let i = 0; i < items.length; i++) {
          const productId = itemProductMap[i];
          if (productId) {
            const product = products.find(p => p.id === productId);
            if (product) {
              await supabase
                .from('products')
                .update({ quantity: (product.quantity || 0) + items[i].quantity })
                .eq('id', productId);
            }
          }
        }
        
        await fetchPurchases();
        closeDialog();
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setFormData({
      supplier_id: '',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: '',
      status: 'draft',
      currency: companySettings?.default_currency || 'TND',
    });
    setItems([{ reference: '', description: '', quantity: 1, unit_price: 0, vat_rate: 19, vat_amount: 0, total: 0 }]);
    setItemProductMap({});
  };

  const addItem = () => {
    setItems([...items, { reference: '', description: '', quantity: 1, unit_price: 0, vat_rate: 19, vat_amount: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems.length > 0 ? newItems : [{ reference: '', description: '', quantity: 1, unit_price: 0, vat_rate: 19, vat_amount: 0, total: 0 }]);
    
    const newMap = { ...itemProductMap };
    delete newMap[index];
    setItemProductMap(newMap);
  };

  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate totals
    const item = newItems[index];
    const itemTotal = item.quantity * item.unit_price;
    const vatAmount = (itemTotal * item.vat_rate) / 100;
    newItems[index].total = itemTotal;
    newItems[index].vat_amount = vatAmount;
    
    setItems(newItems);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const newMap = { ...itemProductMap, [index]: productId };
      setItemProductMap(newMap);
      
      updateItem(index, 'reference', product.sku || product.name);
      updateItem(index, 'description', product.description || product.name);
      updateItem(index, 'unit_price', product.purchase_price || 0);
      updateItem(index, 'vat_rate', product.vat_rate || 19);
    }
    setOpenProductPopover(null);
  };

  const viewPurchase = async (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    
    const { data, error } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', purchase.id);
    
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      setSelectedPurchaseItems(data || []);
      setViewDialogOpen(true);
    }
  };

  const deletePurchase = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet achat ?')) return;

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      toast({ title: 'Succès', description: 'Achat supprimé' });
      fetchPurchases();
    }
  };

  const filteredPurchases = purchases.filter(p =>
    p.purchase_number?.toLowerCase().includes(search.toLowerCase()) ||
    p.suppliers?.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Achats</h1>
          <p className="text-muted-foreground">Gérez vos achats et factures fournisseurs</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvel achat
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer un achat</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supplier">Fournisseur *</Label>
                  <Select value={formData.supplier_id} onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un fournisseur" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Statut</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="sent">Envoyé</SelectItem>
                      <SelectItem value="paid">Payé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issue_date">Date d'émission</Label>
                  <Input
                    id="issue_date"
                    type="date"
                    value={formData.issue_date}
                    onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Date d'échéance</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Articles</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter une ligne
                  </Button>
                </div>

                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-2">
                        <Popover open={openProductPopover === index} onOpenChange={(open) => setOpenProductPopover(open ? index : null)}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between"
                            >
                              {itemProductMap[index] ? products.find(p => p.id === itemProductMap[index])?.name : "Produit"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0">
                            <Command>
                              <CommandInput placeholder="Rechercher un produit..." />
                              <CommandList>
                                <CommandEmpty>Aucun produit trouvé.</CommandEmpty>
                                <CommandGroup>
                                  {products.map((product) => (
                                    <CommandItem
                                      key={product.id}
                                      value={product.name}
                                      onSelect={() => handleProductSelect(index, product.id)}
                                    >
                                      <span>{product.name}</span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="col-span-3">
                        <Input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="Qté"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Prix U."
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="TVA %"
                          value={item.vat_rate}
                          onChange={(e) => updateItem(index, 'vat_rate', Number(e.target.value))}
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between gap-8">
                    <span className="text-muted-foreground">Sous-total HT:</span>
                    <span className="font-medium">{formatCurrency(calculateTotals().subtotal, formData.currency)}</span>
                  </div>
                  <div className="flex justify-between gap-8">
                    <span className="text-muted-foreground">TVA:</span>
                    <span className="font-medium">{formatCurrency(calculateTotals().tax_amount, formData.currency)}</span>
                  </div>
                  <div className="flex justify-between gap-8 text-lg font-bold">
                    <span>Total TTC:</span>
                    <span>{formatCurrency(calculateTotals().total, formData.currency)}</span>
                  </div>
                </div>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Création...' : 'Créer l\'achat'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par numéro ou fournisseur..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {canExport && (
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPurchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Aucun achat trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredPurchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="font-medium">{purchase.purchase_number}</TableCell>
                    <TableCell>{purchase.suppliers?.name || '-'}</TableCell>
                    <TableCell>{new Date(purchase.issue_date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{new Date(purchase.due_date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{formatCurrency(purchase.total, purchase.currency)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[purchase.status]}>
                        {statusLabels[purchase.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => viewPurchase(purchase)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deletePurchase(purchase.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Purchase Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Détails de l'achat {selectedPurchase?.purchase_number}</DialogTitle>
          </DialogHeader>
          {selectedPurchase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fournisseur</Label>
                  <p className="text-sm">{selectedPurchase.suppliers?.name || '-'}</p>
                </div>
                <div>
                  <Label>Statut</Label>
                  <Badge className={statusColors[selectedPurchase.status]}>
                    {statusLabels[selectedPurchase.status]}
                  </Badge>
                </div>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Articles</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Qté</TableHead>
                      <TableHead>Prix U.</TableHead>
                      <TableHead>TVA</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPurchaseItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{formatCurrency(item.unit_price, selectedPurchase.currency)}</TableCell>
                        <TableCell>{item.vat_rate}%</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total, selectedPurchase.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="border-t pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Sous-total HT:</span>
                    <span>{formatCurrency(selectedPurchase.subtotal, selectedPurchase.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TVA:</span>
                    <span>{formatCurrency(selectedPurchase.tax_amount, selectedPurchase.currency)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total TTC:</span>
                    <span>{formatCurrency(selectedPurchase.total, selectedPurchase.currency)}</span>
                  </div>
                </div>
              </div>

              {selectedPurchase.notes && (
                <div>
                  <Label>Notes</Label>
                  <p className="text-sm text-muted-foreground">{selectedPurchase.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
