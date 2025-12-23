import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Plus, Pencil, Trash2, Search, Upload, ArrowUpDown, Eye, FileText, List } from 'lucide-react';
import { getClientInvoiceStatement, ClientInvoiceStatement } from '@/lib/getClientInvoiceStatement';
import { generateClientStatementPDF } from '@/lib/generateClientStatementPDF';
import { Badge } from '@/components/ui/badge';

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  siret: string | null;
  vat_number: string | null;
  user_id?: string;
}

interface ClientInvoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  total: number;
  status: string;
}

type SortField = 'name' | 'email' | 'city';
type SortOrder = 'asc' | 'desc';

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  cancelled: 'Annulée',
  overdue: 'En retard',
};

export default function Clients() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientInvoices, setClientInvoices] = useState<ClientInvoice[]>([]);
  // Invoice statement state
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statement, setStatement] = useState<ClientInvoiceStatement | null>(null);
  const [statementError, setStatementError] = useState<string | null>(null);
  const [statementStart, setStatementStart] = useState<string | undefined>(undefined);
  const [statementEnd, setStatementEnd] = useState<string | undefined>(undefined);
  const { companyRoles, activeCompanyId } = useAuth();

  // Show statement for selected client
  const openStatement = async () => {
    if (!selectedClient || !user) return;
    setStatementOpen(true);
    setStatementLoading(true);
    setStatementError(null);
    try {
      const data = await getClientInvoiceStatement(selectedClient.id, user.id, statementStart, statementEnd);
      setStatement(data);
    } catch (e: any) {
      setStatementError(e.message || 'Erreur lors du chargement du relevé');
    } finally {
      setStatementLoading(false);
    }
  };

  // Auto-load statement when detail dialog opens
  useEffect(() => {
    if (detailDialogOpen && selectedClient && user) {
      openStatement();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailDialogOpen, selectedClient, user, statementStart, statementEnd]);

  // Date range change handler
  const handleStatementDateChange = async (start?: string, end?: string) => {
    setStatementStart(start);
    setStatementEnd(end);
    if (statementOpen && selectedClient && user) {
      setStatementLoading(true);
      setStatementError(null);
      try {
        const data = await getClientInvoiceStatement(selectedClient.id, user.id, start, end);
        setStatement(data);
      } catch (e: any) {
        setStatementError(e.message || 'Erreur lors du chargement du relevé');
      } finally {
        setStatementLoading(false);
      }
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    siret: '',
    vat_number: '',
  });

  useEffect(() => {
    if (user) fetchClients();
  }, [user]);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name');
    
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      setClients(data || []);
    }
    setLoading(false);
  };

  const fetchClientInvoices = async (clientId: string) => {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, issue_date, total, status')
      .eq('client_id', clientId)
      .order('issue_date', { ascending: false });
    
    if (!error) {
      setClientInvoices(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingClient) {
      const { error } = await supabase
        .from('clients')
        .update(formData)
        .eq('id', editingClient.id);
      
      if (error) {
        toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      } else {
        toast({ title: 'Succès', description: 'Client modifié' });
        fetchClients();
        closeDialog();
      }
    } else {
      const { error } = await supabase
        .from('clients')
        .insert({ ...formData, user_id: user?.id });
      
      if (error) {
        toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      } else {
        toast({ title: 'Succès', description: 'Client ajouté' });
        fetchClients();
        closeDialog();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce client ?')) return;
    
    const { error } = await supabase.from('clients').delete().eq('id', id);
    
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      toast({ title: 'Succès', description: 'Client supprimé' });
      fetchClients();
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const clientsToImport: Partial<Client>[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length < 2) continue;
        
        const client: Record<string, string> = { name: '' };
        headers.forEach((header, index) => {
          const mappedHeader = header === 'nom' ? 'name' : 
                              header === 'téléphone' ? 'phone' :
                              header === 'ville' ? 'city' :
                              header === 'adresse' ? 'address' :
                              header === 'code_postal' ? 'postal_code' : header;
          client[mappedHeader] = values[index] || '';
        });
        
        if (client.name) {
          clientsToImport.push({
            name: client.name,
            email: client.email || null,
            phone: client.phone || null,
            address: client.address || null,
            city: client.city || null,
            postal_code: client.postal_code || null,
            siret: client.siret || null,
            vat_number: client.vat_number || null,
            user_id: user?.id || '',
          });
        }
      }

      if (clientsToImport.length > 0) {
        const { error } = await supabase
          .from('clients')
          .insert(clientsToImport as { name: string; email: string | null; phone: string | null; address: string | null; city: string | null; postal_code: string | null; siret: string | null; vat_number: string | null; user_id: string }[]);
        
        if (error) {
          toast({ variant: 'destructive', title: 'Erreur', description: error.message });
        } else {
          toast({ title: 'Succès', description: `${clientsToImport.length} clients importés` });
          fetchClients();
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openEditDialog = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      city: client.city || '',
      postal_code: client.postal_code || '',
      siret: client.siret || '',
      vat_number: client.vat_number || '',
    });
    setDialogOpen(true);
  };

  const openDetailDialog = async (client: Client) => {
    setSelectedClient(client);
    await fetchClientInvoices(client.id);
    setDetailDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingClient(null);
    setFormData({ name: '', email: '', phone: '', address: '', city: '', postal_code: '', siret: '', vat_number: '' });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const cities = [...new Set(clients.map(c => c.city).filter(Boolean))];

  const filteredClients = clients
    .filter(c =>
      (c.name.toLowerCase().includes(search.toLowerCase()) ||
       c.email?.toLowerCase().includes(search.toLowerCase())) &&
      (cityFilter === 'all' || c.city === cityFilter)
    )
    .sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const comparison = aVal.localeCompare(bVal);
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-muted-foreground">Gérez vos clients</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleCSVImport}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingClient(null); setFormData({ name: '', email: '', phone: '', address: '', city: '', postal_code: '', siret: '', vat_number: '' }); }}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingClient ? 'Modifier' : 'Ajouter'} un client</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Nom *</Label>
                    <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div>
                    <Label>Téléphone</Label>
                    <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label>Adresse</Label>
                    <Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                  </div>
                  <div>
                    <Label>Ville</Label>
                    <Input value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
                  </div>
                  <div>
                    <Label>Code postal</Label>
                    <Input value={formData.postal_code} onChange={e => setFormData({ ...formData, postal_code: e.target.value })} />
                  </div>
                  <div>
                    <Label>SIRET</Label>
                    <Input value={formData.siret} onChange={e => setFormData({ ...formData, siret: e.target.value })} />
                  </div>
                  <div>
                    <Label>N° TVA</Label>
                    <Input value={formData.vat_number} onChange={e => setFormData({ ...formData, vat_number: e.target.value })} />
                  </div>
                </div>
                <Button type="submit" className="w-full">{editingClient ? 'Modifier' : 'Ajouter'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fiche client : {selectedClient?.name}</DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Email:</span> {selectedClient.email || '-'}</div>
                <div><span className="text-muted-foreground">Téléphone:</span> {selectedClient.phone || '-'}</div>
                <div><span className="text-muted-foreground">Adresse:</span> {selectedClient.address || '-'}</div>
                <div><span className="text-muted-foreground">Ville:</span> {selectedClient.city || '-'} {selectedClient.postal_code}</div>
                <div><span className="text-muted-foreground">SIRET:</span> {selectedClient.siret || '-'}</div>
                <div><span className="text-muted-foreground">N° TVA:</span> {selectedClient.vat_number || '-'}</div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Historique des factures
                </h3>
                {clientInvoices.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Aucune facture</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° Facture</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientInvoices.map(inv => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                          <TableCell>{new Date(inv.issue_date).toLocaleDateString('fr-FR')}</TableCell>
                          <TableCell>{Number(inv.total).toLocaleString('fr-FR')} DT</TableCell>
                          <TableCell>
                            <Badge variant="outline">{statusLabels[inv.status] || inv.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {/* Statement Section */}
                <div className="mt-8">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <List className="h-4 w-4" />
                    Relevé client
                  </h4>
                  {/* Date range picker and export */}
                  <div className="flex flex-wrap gap-2 items-center mb-4">
                    <Label>Du</Label>
                    <Input type="date" value={statementStart || ''} onChange={e => handleStatementDateChange(e.target.value || undefined, statementEnd)} />
                    <Label>au</Label>
                    <Input type="date" value={statementEnd || ''} onChange={e => handleStatementDateChange(statementStart, e.target.value || undefined)} />
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      disabled={statementLoading || !statement || !!statementError}
                      onClick={() => {
                        if (statement && !statementLoading && !statementError) {
                          generateClientStatementPDF(
                            statement,
                            selectedClient?.name || 'client',
                            { start: statementStart, end: statementEnd }
                          );
                        }
                      }}
                    >
                      {statementLoading ? 'Préparation PDF...' : 'Exporter en PDF'}
                    </Button>
                  </div>
                  {/* Summary cards */}
                  {statementLoading ? (
                    <div>Chargement...</div>
                  ) : statementError ? (
                    <div className="text-destructive">{statementError}</div>
                  ) : statement ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{statement.summary.total_invoiced.toLocaleString('fr-FR')} DT</div><p className="text-sm text-muted-foreground">Total TTC</p></CardContent></Card>
                      <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{statement.summary.total_paid.toLocaleString('fr-FR')} DT</div><p className="text-sm text-muted-foreground">Total payé</p></CardContent></Card>
                      <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{statement.summary.total_balance.toLocaleString('fr-FR')} DT</div><p className="text-sm text-muted-foreground">Solde restant</p></CardContent></Card>
                    </div>
                  ) : null}
                  {/* Invoices table */}
                  {statement && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>N° Facture</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Échéance</TableHead>
                          <TableHead>Total HT</TableHead>
                          <TableHead>TVA</TableHead>
                          <TableHead>Total TTC</TableHead>
                          <TableHead>Payé</TableHead>
                          <TableHead>Solde</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statement.invoices.length === 0 ? (
                          <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Aucune facture</TableCell></TableRow>
                        ) : (
                          statement.invoices.map(inv => (
                            <TableRow key={inv.id}>
                              <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                              <TableCell>{new Date(inv.issue_date).toLocaleDateString('fr-FR')}</TableCell>
                              <TableCell>{new Date(inv.due_date).toLocaleDateString('fr-FR')}</TableCell>
                              <TableCell>{inv.total_ht.toLocaleString('fr-FR')} DT</TableCell>
                              <TableCell>{inv.total_tva.toLocaleString('fr-FR')} DT</TableCell>
                              <TableCell>{inv.total_ttc.toLocaleString('fr-FR')} DT</TableCell>
                              <TableCell>{inv.paid.toLocaleString('fr-FR')} DT</TableCell>
                              <TableCell>{inv.balance.toLocaleString('fr-FR')} DT</TableCell>
                              <TableCell><Badge variant="outline">{statusLabels[inv.status] || inv.status}</Badge></TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filtrer par ville" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les villes</SelectItem>
                {cities.map(city => (
                  <SelectItem key={city} value={city!}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => toggleSort('name')}>
                    Nom <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => toggleSort('email')}>
                    Email <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => toggleSort('city')}>
                    Ville <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Aucun client</TableCell></TableRow>
              ) : (
                filteredClients.map(client => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.email || '-'}</TableCell>
                    <TableCell>{client.phone || '-'}</TableCell>
                    <TableCell>{client.city || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openDetailDialog(client)} title="Voir fiche client">
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(client)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(client.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
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
    </div>
  );
}
