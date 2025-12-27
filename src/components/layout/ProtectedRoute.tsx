import React, { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '@/components/ui/button';
import { NO_ACCESS_MSG } from '@/lib/permissions';

// Re-export ModuleProtectedRoute for convenience
export { ModuleProtectedRoute } from './ModuleProtectedRoute';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { globalRole, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (globalRole !== 'SUPER_ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-4">
          <h2 className="text-2xl font-semibold">Accès refusé</h2>
          <p className="text-muted-foreground">{NO_ACCESS_MSG}</p>
          <div>
            <Button onClick={() => navigate('/dashboard')}>Retour au tableau de bord</Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { globalRole, loading } = useAuth();

  if (loading) {
    return <div className="p-6">Chargement…</div>;
  }

  if (globalRole !== 'SUPER_ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export function CompanyAdminRoute({ children }: { children: React.ReactNode }) {
  const { loading, globalRole, companyRoles, activeCompanyId, role } = useAuth();

  if (loading) {
    return <div className="p-6">Chargement…</div>;
  }

  // Super admin can access everything
  if (globalRole === 'SUPER_ADMIN') {
    return <>{children}</>;
  }

  // Require an active company context
  if (!activeCompanyId) {
    return <Navigate to="/dashboard" replace />;
  }

  const isCompanyAdmin =
    companyRoles.some((r) => r.company_id === activeCompanyId && r.role === 'COMPANY_ADMIN') ||
    role === 'admin'; // temporary backward compatibility (treat legacy admin as company admin)

  if (!isCompanyAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
