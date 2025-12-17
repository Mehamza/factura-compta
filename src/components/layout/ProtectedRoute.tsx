import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '@/components/ui/button';
import { NO_ACCESS_MSG } from '@/lib/permissions';

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

export function CompanyAdminRoute({ children, companyId }: { children: React.ReactNode, companyId?: string }) {
  const { globalRole, companyRoles, activeCompanyId, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const targetCompany = companyId ?? activeCompanyId;
  const isCompanyAdmin = !!companyRoles.find(r => r.company_id === targetCompany && r.role === 'COMPANY_ADMIN');
  const isAllowed = globalRole === 'SUPER_ADMIN' || isCompanyAdmin;

  if (!isAllowed) {
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
