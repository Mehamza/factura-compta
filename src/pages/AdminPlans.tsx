import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

type Plan = {
  id: string;
  name: string;
  description: string | null;
  price_year: number;
  duration: string;
  active: boolean;
  display_order: number;
};

type Feature = { id: string; plan_id: string; key: string; value: any };

export default function AdminPlans() {
  useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Record<string, Feature[]>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price_year: '0', duration: 'annuel', active: true, display_order: '0' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data: plansData } = await (supabase.from('plans' as any).select('*').order('display_order') as any);
    setPlans((plansData as Plan[]) || []);
    const byPlan: Record<string, Feature[]> = {};
    const { data: feats } = await (supabase.from('plan_features' as any).select('*') as any);
    ((feats as any[]) || []).forEach((f: any) => {
      if (!byPlan[f.plan_id]) byPlan[f.plan_id] = [];
      byPlan[f.plan_id].push({ id: f.id, plan_id: f.plan_id, key: f.key, value: f.value });
    });
    setFeatures(byPlan);
  };

  const openNew = () => { setEditing(null); setForm({ name: '', description: '', price_year: '0', duration: 'annuel', active: true, display_order: '0' }); setOpen(true); };
  const openEdit = (p: Plan) => { setEditing(p); setForm({ name: p.name, description: p.description || '', price_year: String(p.price_year), duration: p.duration, active: p.active, display_order: String(p.display_order) }); setOpen(true); };

  const savePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name: form.name.trim(), description: form.description.trim() || null, price_year: Number(form.price_year), duration: form.duration, active: form.active, display_order: Number(form.display_order) };
    if (editing) {
      const { error } = await (supabase.from('plans' as any).update(payload as any).eq('id', editing.id) as any);
      if (error) toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      else { toast({ title: 'Succès', description: 'Plan mis à jour' }); setOpen(false); load(); }
    } else {
      const { error } = await (supabase.from('plans' as any).insert(payload as any) as any);
      if (error) toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      else { toast({ title: 'Succès', description: 'Plan ajouté' }); setOpen(false); load(); }
    }
  };

  const removePlan = async (id: string) => {
    if (!confirm('Supprimer ce plan ?')) return;
    const { error } = await (supabase.from('plans' as any).delete().eq('id', id) as any);
    if (error) toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    else { toast({ title: 'Succès', description: 'Plan supprimé' }); load(); }
  };

  const upsertFeature = async (planId: string, key: string, value: any) => {
    const existing = (features[planId] || []).find(f => f.key === key);
    if (existing) {
      const { error } = await (supabase.from('plan_features' as any).update({ value } as any).eq('id', existing.id) as any);
      if (!error) {
        setFeatures(prev => ({ ...prev, [planId]: (prev[planId] || []).map(f => f.id === existing.id ? { ...f, value } : f) }));
        toast({ title: 'Succès', description: 'Fonctionnalité mise à jour' });
      }
    } else {
      const { data, error } = await (supabase.from('plan_features' as any).insert({ plan_id: planId, key, value } as any).select().single() as any);
      if (!error && data) {
        setFeatures(prev => ({ ...prev, [planId]: [...(prev[planId] || []), { id: data.id, plan_id: planId, key, value }] }));
        toast({ title: 'Succès', description: 'Fonctionnalité ajoutée' });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin / Plans & Tarification</h1>
          <p className="text-muted-foreground">Gérez les plans, prix et fonctionnalités</p>
        </div>
        <Button onClick={openNew}>Ajouter un plan</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">Plans existants</div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Prix (TND/an)</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Ordre</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{Number(p.price_year).toLocaleString('fr-FR')}</TableCell>
                  <TableCell>{p.active ? <Badge variant="outline">Actif</Badge> : <Badge variant="destructive">Inactif</Badge>}</TableCell>
                  <TableCell>{p.display_order}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(p)}>Modifier</Button>
                      <Button variant="destructive" size="sm" onClick={() => removePlan(p.id)}>Supprimer</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Feature toggles per plan */}
      <Card>
        <CardHeader>
          <div className="text-sm text-muted-foreground">Fonctionnalités par plan</div>
        </CardHeader>
        <CardContent>
          {plans.map(p => (
            <div key={p.id} className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">{p.name}</div>
                <Badge variant="outline">{features[p.id]?.length || 0} fonctionnalités</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 p-3 border rounded-md">
                  <div className="font-medium">Facturation</div>
                  <div className="flex items-center justify-between">
                    <span>Factures illimitées</span>
                    <Switch checked={Boolean(features[p.id]?.find(f => f.key === 'billing.invoices_unlimited')?.value?.enabled)} onCheckedChange={(v) => upsertFeature(p.id, 'billing.invoices_unlimited', { enabled: v })} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>Max/jour</Label>
                    <Input type="number" className="h-8" value={features[p.id]?.find(f => f.key === 'billing.max_invoices_per_day')?.value?.value ?? ''} onChange={(e) => upsertFeature(p.id, 'billing.max_invoices_per_day', { value: Number(e.target.value || 0) })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Modification facture</span>
                    <Switch checked={Boolean(features[p.id]?.find(f => f.key === 'billing.invoice_edit')?.value?.enabled)} onCheckedChange={(v) => upsertFeature(p.id, 'billing.invoice_edit', { enabled: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Watermark PDF</span>
                    <Switch checked={Boolean(features[p.id]?.find(f => f.key === 'billing.pdf_watermark')?.value?.enabled)} onCheckedChange={(v) => upsertFeature(p.id, 'billing.pdf_watermark', { enabled: v })} />
                  </div>
                </div>

                <div className="space-y-2 p-3 border rounded-md">
                  <div className="font-medium">Utilisateurs</div>
                  <div className="flex items-center gap-2">
                    <Label>Max utilisateurs</Label>
                    <Input type="number" className="h-8" value={features[p.id]?.find(f => f.key === 'users.max_users')?.value?.value ?? ''} onChange={(e) => upsertFeature(p.id, 'users.max_users', { value: Number(e.target.value || 0) })} />
                  </div>
                </div>

                <div className="space-y-2 p-3 border rounded-md">
                  <div className="font-medium">Stock</div>
                  <div className="flex items-center justify-between">
                    <span>Lecture seule</span>
                    <Switch checked={Boolean(features[p.id]?.find(f => f.key === 'stock.readonly')?.value?.enabled)} onCheckedChange={(v) => upsertFeature(p.id, 'stock.readonly', { enabled: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Gestion produits</span>
                    <Switch checked={Boolean(features[p.id]?.find(f => f.key === 'stock.manage_products')?.value?.enabled)} onCheckedChange={(v) => upsertFeature(p.id, 'stock.manage_products', { enabled: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Alertes stock</span>
                    <Switch checked={Boolean(features[p.id]?.find(f => f.key === 'stock.stock_alerts')?.value?.enabled)} onCheckedChange={(v) => upsertFeature(p.id, 'stock.stock_alerts', { enabled: v })} />
                  </div>
                </div>

                <div className="space-y-2 p-3 border rounded-md">
                  <div className="font-medium">Export</div>
                  <div className="flex items-center justify-between">
                    <span>Export CSV</span>
                    <Switch checked={Boolean(features[p.id]?.find(f => f.key === 'export.csv')?.value?.enabled)} onCheckedChange={(v) => upsertFeature(p.id, 'export.csv', { enabled: v })} />
                  </div>
                </div>

                <div className="space-y-2 p-3 border rounded-md">
                  <div className="font-medium">Rapports</div>
                  <div className="flex items-center justify-between">
                    <span>Accès rapports</span>
                    <Switch checked={Boolean(features[p.id]?.find(f => f.key === 'reports.access')?.value?.enabled)} onCheckedChange={(v) => upsertFeature(p.id, 'reports.access', { enabled: v })} />
                  </div>
                </div>

                <div className="space-y-2 p-3 border rounded-md">
                  <div className="font-medium">Comptabilité</div>
                  <div className="flex items-center justify-between">
                    <span>Accès module comptable</span>
                    <Switch checked={Boolean(features[p.id]?.find(f => f.key === 'accounting.access')?.value?.enabled)} onCheckedChange={(v) => upsertFeature(p.id, 'accounting.access', { enabled: v })} />
                  </div>
                </div>
              </div>
              <Separator className="my-4" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le plan' : 'Ajouter un plan'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={savePlan} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom du plan *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Prix (TND/an)</Label>
                <Input type="number" step="0.01" value={form.price_year} onChange={(e) => setForm({ ...form, price_year: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Durée</Label>
                <Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Ordre</Label>
                <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <span>Actif</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit">{editing ? 'Enregistrer' : 'Ajouter'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
