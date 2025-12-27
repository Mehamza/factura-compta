import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { canAccessRoute } from '@/lib/navigationPermissions';
import { NavigationRole } from '@/config/navigationConfig';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

interface ModuleProtectedRouteProps {
  children: React.ReactNode;
}

export function ModuleProtectedRoute({ children }: ModuleProtectedRouteProps) {
  const { role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Cast role to NavigationRole for permission check
  const navigationRole = role as NavigationRole | null | undefined;
  
  if (!canAccessRoute(location.pathname, navigationRole)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-semibold">Accès restreint</h2>
          <p className="text-muted-foreground">
            Vous n'avez pas l'autorisation d'accéder à cette section.
          </p>
          <div>
            <Button asChild>
              <a href="/dashboard">Retour au tableau de bord</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
