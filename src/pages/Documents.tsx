import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
  Upload, 
  FileText, 
  Image, 
  File, 
  Trash2, 
  Download, 
  Search,
  Eye,
  Plus,
  Filter,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { logger } from '@/lib/logger';

interface Document {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  category: string;
  description: string | null;
  invoice_id: string | null;
  client_id: string | null;
  supplier_id: string | null;
  created_at: string;
  invoices?: { invoice_number: string } | null;
  clients?: { name: string } | null;
  suppliers?: { name: string } | null;
}

interface Client {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
}

const categories = [
  { value: 'facture_achat', label: "Facture d'achat" },
  { value: 'recu', label: 'Reçu' },
  { value: 'photo', label: 'Photo' },
  { value: 'contrat', label: 'Contrat' },
  { value: 'devis', label: 'Devis' },
  { value: 'other', label: 'Autre' },
];

const categoryColors: Record<string, string> = {
  facture_achat: 'bg-blue-100 text-blue-800',
  recu: 'bg-green-100 text-green-800',
  photo: 'bg-purple-100 text-purple-800',
  contrat: 'bg-orange-100 text-orange-800',
  devis: 'bg-yellow-100 text-yellow-800',
  other: 'bg-gray-100 text-gray-800',
};

export default function Documents() {
  const { user, activeCompanyId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  
  const [newDoc, setNewDoc] = useState({
    file: null as File | null,
    category: 'other',
    description: '',
    invoice_id: '',
    client_id: '',
    supplier_id: '',
  });

  useEffect(() => {
    if (user && activeCompanyId) {
      fetchDocuments();
      fetchClients();
      fetchSuppliers();
      fetchInvoices();
    }
  }, [user, activeCompanyId]);

  const fetchDocuments = async () => {
    try {
      if (!activeCompanyId) return;
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          invoices:invoice_id(invoice_number),
          clients:client_id(name),
          suppliers:supplier_id(name)
        `)
        .eq('company_id', activeCompanyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      logger.error('Erreur lors du chargement des documents:', error);
      toast.error('Erreur lors du chargement des documents');
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    if (!activeCompanyId) return;
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .eq('company_id', activeCompanyId)
      .order('name');
    setClients(data || []);
  };

  const fetchSuppliers = async () => {
    if (!activeCompanyId) return;
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('company_id', activeCompanyId)
      .order('name');
    setSuppliers(data || []);
  };

  const fetchInvoices = async () => {
    if (!activeCompanyId) return;
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number')
      .eq('company_id', activeCompanyId)
      .order('invoice_number', { ascending: false });
    setInvoices(data || []);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="h-5 w-5" />;
    if (fileType === 'application/pdf') return <FileText className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Le fichier ne doit pas dépasser 10 MB');
        return;
      }
      setNewDoc({ ...newDoc, file });
    }
  };

  const handleUpload = async () => {
    if (!newDoc.file || !user) return;

    setUploading(true);
    try {
      const fileExt = newDoc.file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, newDoc.file);

      if (uploadError) throw uploadError;

      // Save metadata
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          company_id: activeCompanyId,
          file_name: newDoc.file.name,
          file_path: filePath,
          file_size: newDoc.file.size,
          file_type: newDoc.file.type,
          category: newDoc.category,
          description: newDoc.description || null,
          invoice_id: newDoc.invoice_id || null,
          client_id: newDoc.client_id || null,
          supplier_id: newDoc.supplier_id || null,
        });

      if (dbError) throw dbError;

      toast.success('Document téléversé avec succès');
      setDialogOpen(false);
      setNewDoc({
        file: null,
        category: 'other',
        description: '',
        invoice_id: '',
        client_id: '',
        supplier_id: '',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchDocuments();
    } catch (error) {
      logger.error('Erreur lors du téléversement:', error);
      toast.error('Erreur lors du téléversement du document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('company_id', activeCompanyId)
        .eq('id', doc.id);

      if (dbError) throw dbError;

      toast.success('Document supprimé');
      fetchDocuments();
    } catch (error) {
      logger.error('Erreur lors de la suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Erreur lors du téléchargement:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const handlePreview = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 3600);

      if (error) throw error;

      setPreviewUrl(data.signedUrl);
      setPreviewOpen(true);
    } catch (error) {
      logger.error('Erreur lors de la prévisualisation:', error);
      toast.error('Erreur lors de la prévisualisation');
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

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
          <h1 className="text-3xl font-bold text-foreground">Documents</h1>
          <p className="text-muted-foreground">
            Gérez vos factures d'achat, reçus et pièces jointes
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Téléverser un document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Fichier</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {newDoc.file ? (
                    <div className="flex items-center justify-center gap-2">
                      {getFileIcon(newDoc.file.type)}
                      <span className="font-medium">{newDoc.file.name}</span>
                      <span className="text-muted-foreground">
                        ({formatFileSize(newDoc.file.size)})
                      </span>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      <Upload className="h-8 w-8 mx-auto mb-2" />
                      <p>Cliquez pour sélectionner un fichier</p>
                      <p className="text-sm">Max 10 MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                />
              </div>

              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select
                  value={newDoc.category}
                  onValueChange={(value) => setNewDoc({ ...newDoc, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Description (optionnel)</Label>
                <Textarea
                  value={newDoc.description}
                  onChange={(e) => setNewDoc({ ...newDoc, description: e.target.value })}
                  placeholder="Description du document..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Associer à une facture (optionnel)</Label>
                  <Select
                    value={newDoc.invoice_id || 'none'}
                    onValueChange={(value) => setNewDoc({ ...newDoc, invoice_id: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une facture" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      {invoices.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.invoice_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Associer à un client (optionnel)</Label>
                  <Select
                    value={newDoc.client_id || 'none'}
                    onValueChange={(value) => setNewDoc({ ...newDoc, client_id: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Associer à un fournisseur (optionnel)</Label>
                  <Select
                    value={newDoc.supplier_id || 'none'}
                    onValueChange={(value) => setNewDoc({ ...newDoc, supplier_id: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un fournisseur" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleUpload}
                disabled={!newDoc.file || uploading}
                className="w-full"
              >
                {uploading ? 'Téléversement...' : 'Téléverser'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un document..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun document trouvé</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fichier</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Taille</TableHead>
                  <TableHead>Associations</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getFileIcon(doc.file_type)}
                        <div>
                          <p className="font-medium truncate max-w-[200px]">
                            {doc.file_name}
                          </p>
                          {doc.description && (
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {doc.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={categoryColors[doc.category] || categoryColors.other}>
                        {categories.find((c) => c.value === doc.category)?.label || doc.category}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatFileSize(doc.file_size)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {doc.invoices && (
                          <span className="text-xs text-muted-foreground">
                            Facture: {doc.invoices.invoice_number}
                          </span>
                        )}
                        {doc.clients && (
                          <span className="text-xs text-muted-foreground">
                            Client: {doc.clients.name}
                          </span>
                        )}
                        {doc.suppliers && (
                          <span className="text-xs text-muted-foreground">
                            Fournisseur: {doc.suppliers.name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(doc.created_at), 'dd MMM yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {(doc.file_type.startsWith('image/') ||
                          doc.file_type === 'application/pdf') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(doc)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(doc)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                              <AlertDialogDescription>
                                Êtes-vous sûr de vouloir supprimer "{doc.file_name}" ?
                                Cette action est irréversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(doc)}>
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Aperçu du document</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="overflow-auto max-h-[70vh]">
              {previewUrl.includes('.pdf') ? (
                <iframe src={previewUrl} className="w-full h-[70vh]" />
              ) : (
                <img src={previewUrl} alt="Aperçu" className="max-w-full" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
