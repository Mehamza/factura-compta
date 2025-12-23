import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Shield, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Espace Super Admin</h1>
        <p className="text-muted-foreground">Gestion globale de l’application et des utilisateurs.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer" onClick={() => navigate('/hamzafacturation/utilisateurs')}>
          <CardHeader className="flex flex-row items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Utilisateurs globaux</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Voir, gérer et impersonner tous les utilisateurs</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => navigate('/hamzafacturation/plans')}>
          <CardHeader className="flex flex-row items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <CardTitle>Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Gérer les plans d’abonnement et les permissions</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
