import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Search, UserCog, Trash2, LogIn, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface UserRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  legacy_role: string | null;
  global_role: string | null;
}

export default function AdminUsers() {
  const { toast } = useToast();
  const { session, startImpersonation } = useAuth();
  
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load all users (across all companies)
  const loadUsers = async () => {
    setLoading(true);
    try {
      // Get profiles with pagination
      let query = supabase
        .from('profiles')
        .select('user_id, email, full_name, created_at', { count: 'exact' });

      // Apply search filter
      if (search.trim()) {
        query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to).order('created_at', { ascending: false });

      const { data: profiles, error, count } = await query;

      if (error) throw error;

      setTotalCount(count || 0);

      // Get roles for these users
      const userIds = (profiles || []).map((p: any) => p.user_id);
      
      // Fetch legacy roles
      const { data: legacyRoles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      // Fetch global roles
      const { data: globalRoles } = await supabase
        .from('user_global_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      // Map roles to users
      const legacyRoleMap = new Map((legacyRoles || []).map((r: any) => [r.user_id, r.role]));
      const globalRoleMap = new Map((globalRoles || []).map((r: any) => [r.user_id, r.role]));

      const usersWithRoles: UserRow[] = (profiles || []).map((p: any) => ({
        user_id: p.user_id,
        email: p.email,
        full_name: p.full_name,
        created_at: p.created_at,
        legacy_role: legacyRoleMap.get(p.user_id) || null,
        global_role: globalRoleMap.get(p.user_id) || null,
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, search]);

  // Handle impersonation
  const handleImpersonate = async (user: UserRow) => {
    try {
      await startImpersonation(user.user_id);
      toast({
        title: 'Impersonation activée',
        description: `Vous êtes maintenant connecté en tant que ${user.full_name || user.email}`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message,
      });
    }
  };

  // Handle user deletion
  const handleDelete = async () => {
    if (!deleteTarget || !session?.access_token) return;
    
    setDeleting(true);
    try {
      const response = await supabase.functions.invoke('delete_user', {
        body: { target_user_id: deleteTarget.user_id },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      toast({
        title: 'Utilisateur supprimé',
        description: `${deleteTarget.full_name || deleteTarget.email} a été supprimé.`,
      });
      
      setDeleteTarget(null);
      loadUsers();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message,
      });
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Role badge helper
  const getRoleBadge = (role: string | null, type: 'legacy' | 'global') => {
    if (!role) return null;
    
    if (type === 'global') {
      if (role.toUpperCase() === 'SUPER_ADMIN') {
        return <Badge variant="destructive" className="text-xs">Super Admin</Badge>;
      }
      return <Badge variant="secondary" className="text-xs">{role}</Badge>;
    }
    
    // Legacy roles
    const roleLabels: Record<string, string> = {
      admin: 'Admin',
      manager: 'Gérant',
      accountant: 'Comptable',
      cashier: 'Caissier',
    };
    return <Badge variant="outline" className="text-xs">{roleLabels[role] || role}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Gestion globale des utilisateurs
          </h1>
          <p className="text-muted-foreground">
            Voir et gérer tous les utilisateurs de l'application
          </p>
        </div>
        <Badge variant="secondary">{totalCount} utilisateur{totalCount > 1 ? 's' : ''}</Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1); // Reset to first page on search
                }}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom complet</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle global</TableHead>
                <TableHead>Rôle legacy</TableHead>
                <TableHead>Date d'inscription</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Aucun utilisateur trouvé
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">
                      {user.full_name || <span className="text-muted-foreground italic">Non renseigné</span>}
                    </TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>{getRoleBadge(user.global_role, 'global') || '-'}</TableCell>
                    <TableCell>{getRoleBadge(user.legacy_role, 'legacy') || '-'}</TableCell>
                    <TableCell>
                      {user.created_at
                        ? format(new Date(user.created_at), 'dd MMM yyyy', { locale: fr })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <UserCog className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuItem
                                onClick={() => handleImpersonate(user)}
                                disabled={user.global_role?.toUpperCase() === 'SUPER_ADMIN'}
                              >
                                <LogIn className="h-4 w-4 mr-2" />
                                Se connecter en tant que
                              </DropdownMenuItem>
                            </TooltipTrigger>
                            {user.global_role?.toUpperCase() === 'SUPER_ADMIN' && (
                              <TooltipContent>
                                Impossible d'impersonner un Super Admin
                              </TooltipContent>
                            )}
                          </Tooltip>
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(user)}
                            disabled={user.global_role?.toUpperCase() === 'SUPER_ADMIN'}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} sur {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l'utilisateur{' '}
              <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong> ?
              <br /><br />
              Cette action est irréversible. Les données liées à cet utilisateur
              (factures, clients, etc.) seront conservées mais ne seront plus associées à un utilisateur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
