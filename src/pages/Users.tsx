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
  const { user, role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role !== 'admin') {
      toast({ variant: 'destructive', title: 'Accès refusé', description: 'Vous devez être administrateur' });
      navigate('/');
      return;
    }
    fetchUsers();
  }, [role, navigate]);

  const fetchUsers = async () => {
    try {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, created_at, email');

      // Backward-compat: some remotes may not have profiles.email yet.
      if (profilesError) {
        const msg = String(profilesError.message ?? '');
        const missingEmailColumn = msg.toLowerCase().includes('column') && msg.toLowerCase().includes('email') && msg.toLowerCase().includes('does not exist');
        if (!missingEmailColumn) throw profilesError;
      }

      const profilesSafe: ProfileRow[] = profilesError
        ? ((await supabase.from('profiles').select('user_id, full_name, created_at')).data as unknown as ProfileRow[]) ?? []
        : ((profiles as unknown as ProfileRow[]) ?? []);

      // Get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combine data
      const usersData: UserWithRole[] = (profilesSafe || []).map((profile) => {
        const userRole = roles?.find(r => r.user_id === profile.user_id);
        return {
          id: profile.user_id,
          email: profile.email ?? '',
          full_name: profile.full_name,
          role: (userRole?.role as AppRole) || 'admin',
          created_at: profile.created_at,
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
