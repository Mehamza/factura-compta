import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  siret: string | null;
  vat_number: string | null;
}

export default function Suppliers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
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
    if (user) fetchSuppliers();
  }, [user]);

  const fetchSuppliers = async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name');
    
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      setSuppliers(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingSupplier) {
      const { error } = await supabase
        .from('suppliers')
        .update(formData)
        .eq('id', editingSupplier.id);
      
      if (error) {
        toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      } else {
        toast({ title: 'Succès', description: 'Fournisseur modifié' });
        fetchSuppliers();
        closeDialog();
      }
    } else {
      const { error } = await supabase
        .from('suppliers')
        .insert({ ...formData, user_id: user?.id });
      
      if (error) {
        toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      } else {
        toast({ title: 'Succès', description: 'Fournisseur ajouté' });
        fetchSuppliers();
        closeDialog();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce fournisseur ?')) return;
    
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      toast({ title: 'Succès', description: 'Fournisseur supprimé' });
      fetchSuppliers();
    }
  };

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      city: supplier.city || '',
      postal_code: supplier.postal_code || '',
      siret: supplier.siret || '',
      vat_number: supplier.vat_number || '',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingSupplier(null);
    setFormData({ name: '', email: '', phone: '', address: '', city: '', postal_code: '', siret: '', vat_number: '' });
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Fournisseurs</h1>
          <p className="text-muted-foreground">Gérez vos fournisseurs</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingSupplier(null); setFormData({ name: '', email: '', phone: '', address: '', city: '', postal_code: '', siret: '', vat_number: '' }); }}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingSupplier ? 'Modifier' : 'Ajouter'} un fournisseur</DialogTitle>
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
              <Button type="submit" className="w-full">{editingSupplier ? 'Modifier' : 'Ajouter'}</Button>
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
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Aucun fournisseur</TableCell></TableRow>
              ) : (
                filteredSuppliers.map(supplier => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>{supplier.email || '-'}</TableCell>
                    <TableCell>{supplier.phone || '-'}</TableCell>
                    <TableCell>{supplier.city || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(supplier)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(supplier.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
