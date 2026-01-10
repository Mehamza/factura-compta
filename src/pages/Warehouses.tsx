import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { NO_PERMISSION_MSG } from '@/lib/permissions';
import { supabase } from '@/integrations/supabase/client';

type Warehouse = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export default function Warehouses() {
  const { role, activeCompanyId } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    address: '',
    city: '',
    country: 'Tunisie',
    manager_name: '',
    manager_phone: '',
    is_default: false,
    is_active: true,
  });

  const canManage = useMemo(() => role === 'admin' || role === 'manager', [role]);

  const load = async () => {
    if (!activeCompanyId) return;
    setLoading(true);

    const { data, error } = await supabase.functions.invoke('warehouses', {
      body: { action: 'list', company_id: activeCompanyId },
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      setWarehouses((data?.data || []) as Warehouse[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId]);

  const openNew = () => {
    if (!canManage) {
      toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG });
      return;
    }

    setEditing(null);
    setForm({
      code: '',
      name: '',
      address: '',
      city: '',
      country: 'Tunisie',
      manager_name: '',
      manager_phone: '',
      is_default: warehouses.length === 0,
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (w: Warehouse) => {
    if (!canManage) {
      toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG });
      return;
    }

    setEditing(w);
    setForm({
      code: w.code,
      name: w.name,
      address: w.address || '',
      city: w.city || '',
      country: w.country || 'Tunisie',
      manager_name: w.manager_name || '',
      manager_phone: w.manager_phone || '',
      is_default: Boolean(w.is_default),
      is_active: Boolean(w.is_active),
    });
    setDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeCompanyId) return;
    if (!canManage) {
      toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG });
      return;
    }

    if (!form.code.trim()) {
      toast({ variant: 'destructive', title: 'Champs requis', description: 'Le code est obligatoire.' });
      return;
    }

    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: 'Champs requis', description: 'Le nom est obligatoire.' });
      return;
    }

    const action = editing ? 'update' : 'create';

    const { data, error } = await supabase.functions.invoke('warehouses', {
      body: {
        action,
        company_id: activeCompanyId,
        id: editing?.id,
        code: form.code,
        name: form.name,
        address: form.address || null,
        city: form.city || null,
        country: form.country || null,
        manager_name: form.manager_name || null,
        manager_phone: form.manager_phone || null,
        is_default: form.is_default,
        is_active: form.is_active,
      },
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      return;
    }

    toast({ title: 'Succès', description: editing ? 'Entrepôt modifié' : 'Entrepôt créé' });
    setDialogOpen(false);
    await load();

    // If we just set default, reload list reflects single-default constraint.
    void data;
  };

  const remove = async (id: string) => {
    if (!activeCompanyId) return;
    if (!canManage) {
      toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG });
      return;
    }

    const w = warehouses.find((x) => x.id === id);
    if (w?.is_default) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de supprimer l’entrepôt par défaut.' });
      return;
    }

    const { error } = await supabase.functions.invoke('warehouses', {
      body: { action: 'delete', company_id: activeCompanyId, id },
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      return;
    }

    toast({ title: 'Succès', description: 'Entrepôt supprimé' });
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock / Entrepôts</h1>
          <p className="text-muted-foreground">Créer et gérer vos entrepôts (soft delete).</p>
        </div>
        <Button onClick={openNew} disabled={!canManage}>
          <Plus className="h-4 w-4" /> Nouveau
        </Button>
      </div>

      <Card>
        <CardHeader />
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Aucun entrepôt
                    </TableCell>
                  </TableRow>
                ) : (
                  warehouses.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{w.name}</span>
                          {w.is_default && <Badge>Par défaut</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>{w.city || '—'}</TableCell>
                      <TableCell>{w.manager_name || '—'}</TableCell>
                      <TableCell>
                        {w.is_active ? (
                          <Badge variant="secondary">Actif</Badge>
                        ) : (
                          <Badge variant="outline">Inactif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="icon" onClick={() => openEdit(w)} disabled={!canManage}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => remove(w.id)}
                            disabled={!canManage || w.is_default}
                            aria-label="Supprimer"
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
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier un entrepôt' : 'Créer un entrepôt'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Code *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div>
              <Label>Nom *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="md:col-span-2">
              <Label>Adresse</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>

            <div>
              <Label>Ville</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <Label>Pays</Label>
              <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </div>

            <div>
              <Label>Responsable</Label>
              <Input value={form.manager_name} onChange={(e) => setForm({ ...form, manager_name: e.target.value })} />
            </div>
            <div>
              <Label>Téléphone responsable</Label>
              <Input value={form.manager_phone} onChange={(e) => setForm({ ...form, manager_phone: e.target.value })} />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3 md:col-span-2">
              <div>
                <div className="font-medium">Entrepôt par défaut</div>
                <div className="text-sm text-muted-foreground">Un seul entrepôt peut être par défaut.</div>
              </div>
              <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3 md:col-span-2">
              <div>
                <div className="font-medium">Actif</div>
                <div className="text-sm text-muted-foreground">Masque l’entrepôt sans le supprimer.</div>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={!canManage}>
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
