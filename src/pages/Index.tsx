import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Dashboard from '@/pages/Dashboard';

const Index = () => {
  const { user, loading, globalRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && user && globalRole === 'SUPER_ADMIN') {
      navigate('/hamzafacturation', { replace: true });
    }
  }, [user, loading, globalRole, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || globalRole === 'SUPER_ADMIN') {
    return null;
  }

  return <Dashboard />;
};

export default Index;
