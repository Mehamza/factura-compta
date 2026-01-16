import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Shield, Users } from 'lucide-react';
import { logger } from '@/lib/logger';
import { NO_ACCESS_MSG } from '@/lib/permissions';

type AppRole = 'admin' | 'accountant' | 'manager' | 'cashier';

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  created_at: string;
  email?: string | null;
};

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  created_at: string;
}

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrateur',
  accountant: 'Comptable',
  manager: 'Gérant',
  cashier: 'Caissier',
};

const roleBadgeColors: Record<AppRole, string> = {
  admin: 'bg-destructive text-destructive-foreground',
  accountant: 'bg-primary text-primary-foreground',
  manager: 'bg-secondary text-secondary-foreground',
  cashier: 'bg-muted text-muted-foreground',
};

export default function UsersPage() {
  const { user, activeCompanyId, canAccess } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canAccess('administration', 'utilisateurs')) {
      toast({ variant: 'destructive', title: 'Accès refusé', description: NO_ACCESS_MSG });
      navigate('/');
      return;
    }
    fetchUsers();
  }, [navigate, activeCompanyId, canAccess]);

  const fetchUsers = async () => {
    try {
      if (!activeCompanyId) {
        setUsers([]);
        return;
      }

      // Resolve team membership first (server-side scoped)
      const { data: memberships, error: mErr } = await supabase
        .from('company_users')
        .select('user_id')
        .eq('company_id', activeCompanyId);
      if (mErr) throw mErr;

      const userIds = (memberships || []).map((m: any) => m.user_id).filter(Boolean);
      if (userIds.length === 0) {
        setUsers([]);
        return;
      }

      // Get profiles (only those in this company)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, created_at, email')
        .in('user_id', userIds);

      // Backward-compat: some remotes may not have profiles.email yet.
      let profilesSafe: ProfileRow[] = [];
      if (profilesError) {
        const msg = String(profilesError.message ?? '');
        const missingEmailColumn = msg.toLowerCase().includes('column') && msg.toLowerCase().includes('email') && msg.toLowerCase().includes('does not exist');
        if (!missingEmailColumn) throw profilesError;

        profilesSafe =
          ((await supabase
            .from('profiles')
            .select('user_id, full_name, created_at')
            .in('user_id', userIds)).data as unknown as ProfileRow[]) ?? [];
      } else {
        profilesSafe = ((profiles as unknown as ProfileRow[]) ?? []);
      }

      // Get roles (only those in this company)
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);
      if (rolesError) throw rolesError;

      const usersData: UserWithRole[] = userIds.map((uid) => {
        const profile = (profilesSafe || []).find((p) => p.user_id === uid);
        const roleRow = (roles || []).find((r: any) => r.user_id === uid);
        return {
          id: uid,
          email: profile?.email ?? '',
          full_name: profile?.full_name ?? null,
          role: (roleRow?.role as AppRole) || 'cashier',
          created_at: profile?.created_at ?? new Date().toISOString(),
        };
      });

      setUsers(usersData);
    } catch (error) {
      logger.error('Error fetching users:', error);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de charger les utilisateurs' });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    try {
      if (!canAccess('administration', 'utilisateurs')) {
        toast({ variant: 'destructive', title: 'Accès refusé', description: NO_ACCESS_MSG });
        return;
      }

      // Check if user already has a role entry
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingRole) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });
        
        if (error) throw error;
      }

      toast({ title: 'Succès', description: 'Rôle mis à jour' });
      fetchUsers();
    } catch (error) {
      logger.error('Error updating role:', error);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour le rôle' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Gestion des utilisateurs</h1>
          <p className="text-muted-foreground">Gérez les rôles et permissions des utilisateurs</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Utilisateurs ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Rôle actuel</TableHead>
                <TableHead>Date d'inscription</TableHead>
                <TableHead>Modifier le rôle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Aucun utilisateur
                  </TableCell>
                </TableRow>
              ) : (
                users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.full_name || 'Sans nom'}
                      {u.id === user?.id && (
                        <Badge variant="outline" className="ml-2">Vous</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={roleBadgeColors[u.role]}>
                        {roleLabels[u.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(u.created_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(value) => updateUserRole(u.id, value as AppRole)}
                        disabled={u.id === user?.id}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrateur</SelectItem>
                          <SelectItem value="accountant">Comptable</SelectItem>
                          <SelectItem value="manager">Gérant</SelectItem>
                          <SelectItem value="cashier">Caissier</SelectItem>
                        </SelectContent>
                      </Select>
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
