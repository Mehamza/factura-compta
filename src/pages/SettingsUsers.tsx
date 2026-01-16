import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppRole, NO_ACCESS_MSG, ROLE_LABELS } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Pencil, Shield, Users as UsersIcon, Trash2 } from 'lucide-react';
import { navigationConfig } from '@/config/navigationConfig';

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Exclude<AppRole, null | undefined>;
  created_at: string;
  permissions?: { allow?: string[] } | null;
}

export default function SettingsUsers() {
  const { user, activeCompanyId, canAccess } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const allModuleIds = useMemo(() => navigationConfig.map((m) => m.id), []);
  const [form, setForm] = useState({ full_name: '', email: '', role: 'cashier' as Exclude<AppRole, null | undefined>, password: '' });
  const [allow, setAllow] = useState<string[]>(() => ['dashboard', ...allModuleIds]);
  const [editAllow, setEditAllow] = useState<string[]>(() => ['dashboard', ...allModuleIds]);
  const [editRole, setEditRole] = useState<Exclude<AppRole, null | undefined>>('cashier');
  const [emailTaken, setEmailTaken] = useState(false);

  const allowed = canAccess('administration', 'utilisateurs');

  useEffect(() => {
    if (!allowed) {
      toast({ variant: 'destructive', title: 'Accès refusé', description: NO_ACCESS_MSG });
      navigate('/settings');
      return;
    }
    load();
  }, [allowed, activeCompanyId]);

  useEffect(() => {
    if (!openAdd) return;
    // Reset default permissions to full access on dialog open.
    setAllow(['dashboard', ...allModuleIds]);
  }, [allModuleIds, openAdd]);

  useEffect(() => {
    if (!openEdit || !editing) return;
    setEditRole(editing.role);
    const stored = editing.permissions?.allow;
    if (!stored || stored.includes('*')) {
      setEditAllow(['dashboard', ...allModuleIds]);
      return;
    }
    const next = new Set(stored);
    next.add('dashboard');
    setEditAllow(Array.from(next));
  }, [allModuleIds, editing, openEdit]);

  const computePermissionsPayload = (selected: string[]) => {
    const allowNormalized = Array.from(new Set(selected.filter(Boolean)));
    const allowWithDashboard = allowNormalized.includes('dashboard') ? allowNormalized : ['dashboard', ...allowNormalized];
    const hasAllModules = allModuleIds.every((m) => allowWithDashboard.includes(m));
    return hasAllModules ? { allow: ['*'] } : { allow: allowWithDashboard };
  };

  const load = async () => {
    setLoading(true);
    try {
      if (!activeCompanyId) {
        setRows([]);
        return;
      }

      const { data: memberships, error: mErr } = await supabase
        .from('company_users')
        .select('user_id, created_at, permissions')
        .eq('company_id', activeCompanyId);
      if (mErr) throw mErr;

      const userIds = (memberships || []).map((m: any) => m.user_id).filter(Boolean);
      if (userIds.length === 0) {
        setRows([]);
        return;
      }

      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, created_at')
        .in('user_id', userIds);
      if (pErr) throw pErr;

      const { data: roles, error: rErr } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);
      if (rErr) throw rErr;

      const merged: UserRow[] = userIds.map((uid) => {
        const profile = (profiles || []).find((p: any) => p.user_id === uid);
        const roleRow = (roles || []).find((r: any) => r.user_id === uid);
        const membership = (memberships || []).find((m: any) => m.user_id === uid);
        return {
          id: uid,
          full_name: profile?.full_name ?? null,
          email: profile?.email ?? null,
          role: (roleRow?.role as Exclude<AppRole, null | undefined>) || 'cashier',
          created_at: profile?.created_at ?? (memberships || []).find((m: any) => m.user_id === uid)?.created_at,
          permissions: membership?.permissions ?? null,
        };
      });

      setRows(merged.filter((r) => Boolean(r.created_at)));
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Impossible de charger les utilisateurs' });
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (uid: string, newRole: Exclude<AppRole, null | undefined>) => {
    try {
      const { error } = await supabase.from('user_roles').upsert({ user_id: uid, role: newRole }, { onConflict: 'user_id' });

      if (error) throw error;
      toast({ title: 'Succès', description: 'Rôle mis à jour' });
      load();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Impossible de mettre à jour le rôle' });
    }
  };

  const deleteUser = async (uid: string, targetRole: Exclude<AppRole, null | undefined>) => {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    try {
      if (!activeCompanyId) throw new Error('Aucune société active');

      // Remove the user from the current company (do not delete their global profile).
      const { error: cuErr } = await supabase.from('company_users').delete().eq('company_id', activeCompanyId).eq('user_id', uid);
      if (cuErr) throw cuErr;

      toast({ title: 'Succès', description: 'Utilisateur retiré de la société' });
      load();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Échec suppression utilisateur' });
    }
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Aucune société active.' });
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
      const permissions = computePermissionsPayload(allow);

      const { data, error } = await supabase.functions.invoke('create_user', {
        body: {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          password: form.password.trim(),
          role: form.role,
          company_id: activeCompanyId,
          permissions,
        },
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

  const submitEditPermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!activeCompanyId) throw new Error('Aucune société active');
      if (!editing?.id) return;

      const permissions = computePermissionsPayload(editAllow);

      // Update company-scoped permissions
      const { error } = await supabase
        .from('company_users')
        .update({ permissions } as any)
        .eq('company_id', activeCompanyId)
        .eq('user_id', editing.id);
      if (error) throw error;

      // Update legacy role label (still stored in user_roles)
      const { error: roleErr } = await supabase
        .from('user_roles')
        .upsert({ user_id: editing.id, role: editRole }, { onConflict: 'user_id' } as any);
      if (roleErr) throw roleErr;

      toast({ title: 'Succès', description: "Accès mis à jour" });
      setOpenEdit(false);
      setEditing(null);
      load();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Impossible de mettre à jour les accès' });
    }
  };

  const PermissionsSelector = ({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) => {
    return (
      <div className="rounded-md border p-3 space-y-3">
        {navigationConfig.map((module) => {
          const moduleChecked = value.includes(module.id);
          const toggleModule = () => {
            onChange((() => {
              const next = new Set(value);
              if (next.has(module.id)) next.delete(module.id);
              else next.add(module.id);
              next.add('dashboard');
              return Array.from(next);
            })());
          };

          return (
            <div key={module.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox checked={moduleChecked} onCheckedChange={toggleModule} />
                <span className="text-sm font-medium">{module.name}</span>
              </div>

              {module.children && module.children.length > 0 && (
                <div className="pl-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {module.children.map((child) => {
                    const key = `${module.id}.${child.id}`;
                    const checked = moduleChecked || value.includes(key);
                    const toggleChild = () => {
                      onChange((() => {
                        const next = new Set(value);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        next.add('dashboard');
                        return Array.from(next);
                      })());
                    };
                    return (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={checked} disabled={moduleChecked} onCheckedChange={toggleChild} />
                        <span className={moduleChecked ? 'text-muted-foreground' : ''}>{child.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
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
                  <TableCell> {u.role}
                    
                  </TableCell>
                  <TableCell>{new Date(u.created_at).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditing(u);
                          setOpenEdit(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteUser(u.id, u.role)} disabled={u.id === user?.id}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

            <div className="space-y-2">
              <Label>Accès (modules / sous-modules)</Label>
              <PermissionsSelector value={allow} onChange={setAllow} />
            </div>
            <div>
              <Button type="submit" disabled={emailTaken}>Créer l'utilisateur</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openEdit}
        onOpenChange={(open) => {
          setOpenEdit(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l'accès</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEditPermissions} className="grid gap-4">
            <div className="text-sm text-muted-foreground">
              {editing?.full_name || editing?.email || 'Utilisateur'}
            </div>

            <div>
              <Label>Rôle</Label>
              <Select value={editRole} onValueChange={(val) => setEditRole(val as Exclude<AppRole, null | undefined>)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
                  <SelectItem value="manager">{ROLE_LABELS.manager}</SelectItem>
                  <SelectItem value="accountant">{ROLE_LABELS.accountant}</SelectItem>
                  <SelectItem value="cashier">{ROLE_LABELS.cashier}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Accès (modules / sous-modules)</Label>
              <PermissionsSelector value={editAllow} onChange={setEditAllow} />
            </div>

            <div>
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}