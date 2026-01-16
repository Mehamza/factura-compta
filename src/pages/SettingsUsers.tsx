import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppRole, NO_ACCESS_MSG, NO_PERMISSION_MSG, ROLE_LABELS, canAssignRole, canDeleteUser, canManageUsers } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Users as UsersIcon, Trash2 } from 'lucide-react';

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Exclude<AppRole, null | undefined>;
  created_at: string;
}

export default function SettingsUsers() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', role: 'cashier' as Exclude<AppRole, null | undefined>, password: '' });
  const [emailTaken, setEmailTaken] = useState(false);

  const allowed = canManageUsers(role);

  useEffect(() => {
    if (!allowed) {
      toast({ variant: 'destructive', title: 'Accès refusé', description: NO_ACCESS_MSG });
      navigate('/settings');
      return;
    }
    load();
  }, [allowed]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: pErr } = await supabase.from('profiles').select('user_id, full_name, created_at');
      if (pErr) throw pErr;
      const { data: roles, error: rErr } = await supabase.from('user_roles').select('user_id, role');
      if (rErr) throw rErr;

      const merged: UserRow[] = (profiles || []).map((p: any) => ({
        id: p.user_id,
        full_name: p.full_name,
        email: null,
        role: (roles?.find(r => r.user_id === p.user_id)?.role as Exclude<AppRole, null | undefined>) || 'cashier',
        created_at: p.created_at,
      }));
      setRows(merged);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Impossible de charger les utilisateurs' });
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (uid: string, newRole: Exclude<AppRole, null | undefined>) => {
    if (!canAssignRole(role, newRole)) {
      toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG });
      return;
    }
    try {
      const { data: exists } = await supabase.from('user_roles').select('id').eq('user_id', uid).maybeSingle();
      const payload = { user_id: uid, role: newRole } as any;
      const { error } = await supabase.from('user_roles').upsert({ user_id: uid, role: newRole }, { onConflict: 'user_id' });

      if (error) throw error;
      toast({ title: 'Succès', description: 'Rôle mis à jour' });
      load();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Impossible de mettre à jour le rôle' });
    }
  };

  const deleteUser = async (uid: string, targetRole: Exclude<AppRole, null | undefined>) => {
    if (!canDeleteUser(role, targetRole)) {
      toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG });
      return;
    }
    if (!confirm('Supprimer cet utilisateur ?')) return;
    try {
      const { error: rErr } = await supabase.from('user_roles').delete().eq('user_id', uid);
      if (rErr) throw rErr;
      const { error: pErr } = await supabase.from('profiles').delete().eq('user_id', uid);
      if (pErr) throw pErr;
      toast({ title: 'Succès', description: 'Utilisateur supprimé' });
      load();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Échec suppression utilisateur' });
    }
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAssignRole(role, form.role)) {
      toast({ variant: 'destructive', title: 'Permission refusée', description: NO_PERMISSION_MSG });
      return;
    }
    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Nom, email et mot de passe sont obligatoires.' });
      return;
    }
    // Pre-check global email uniqueness (case-insensitive)
    const { data: existing } = await supabase
      .from('profiles')
      .select('user_id')
      .ilike('email', form.email.trim());
    if (existing && existing.length > 0) {
      setEmailTaken(true);
      toast({ variant: 'destructive', title: 'Email déjà utilisé', description: "Cet email est déjà utilisé dans l'application. Un utilisateur ne peut avoir qu'un seul compte." });
      return;
    }
    // Call Edge Function to create auth user securely and assign role
    try {
      const { data, error } = await supabase.functions.invoke('create_user', {
        body: { full_name: form.full_name.trim(), email: form.email.trim(), password: form.password.trim(), role: form.role },
        headers: { 'x-actor-role': role || '' },
      } as any);
      if (error) throw error;
      if (data?.error) { throw new Error(data.error); }
      toast({ title: 'Succès', description: 'Utilisateur créé et compte activé.' });
      setOpenAdd(false);
      load();
    } catch (e: any) {
      const msg = e?.message || "Impossible de créer l'utilisateur";
      toast({ variant: 'destructive', title: 'Erreur', description: msg });
    }
  };

  const sorted = useMemo(() => rows.slice().sort((a, b) => a.full_name?.localeCompare(b.full_name || '') || 0), [rows]);

  if (!allowed) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Paramètres / Utilisateurs</h1>
          <p className="text-muted-foreground">Gérez les utilisateurs et leurs rôles (sauf 4 utilisateurs maximum)</p>
        </div>
        <div className="ml-auto">
          <Button disabled={sorted.length >= 4} title={sorted.length >= 4 ? "Limite d'utilisateurs atteinte" : undefined} onClick={() => setOpenAdd(true)}>Ajouter un utilisateur</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Utilisateurs ({sorted.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Date de création</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">Aucun utilisateur</TableCell>
                </TableRow>
              ) : sorted.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || 'Sans nom'}{u.id === user?.id && <Badge variant="outline" className="ml-2">Vous</Badge>}</TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(val) => updateRole(u.id, val as Exclude<AppRole, null | undefined>)} disabled={!canAssignRole(role, u.role) || u.id === user?.id}>
                      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
                        <SelectItem value="manager">{ROLE_LABELS.manager}</SelectItem>
                        <SelectItem value="accountant">{ROLE_LABELS.accountant}</SelectItem>
                        <SelectItem value="cashier">{ROLE_LABELS.cashier}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{new Date(u.created_at).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="destructive" size="sm" onClick={() => deleteUser(u.id, u.role)} disabled={!canDeleteUser(role, u.role) || u.id === user?.id}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter un utilisateur</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCreate} className="grid gap-4">
            <div>
              <Label>Nom complet</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setEmailTaken(false); }} required />
              {emailTaken && (
                <p className="text-destructive text-xs mt-1">Cet email est déjà utilisé dans l'application. Un utilisateur ne peut avoir qu'un seul compte.</p>
              )}
            </div>
            <div>
              <Label>Rôle</Label>
              <Select value={form.role} onValueChange={(val) => setForm({ ...form, role: val as Exclude<AppRole, null | undefined> })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">{ROLE_LABELS.manager}</SelectItem>
                  <SelectItem value="accountant">{ROLE_LABELS.accountant}</SelectItem>
                  <SelectItem value="cashier">{ROLE_LABELS.cashier}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mot de passe initial</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div>
              <Button type="submit" disabled={emailTaken}>Créer l'utilisateur</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}