import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'accountant' | 'manager' | 'cashier' | 'user';
type GlobalRole = 'SUPER_ADMIN' | 'USER';
type CompanyRole = 'COMPANY_ADMIN' | 'ACCOUNTANT' | 'CASHIER' | 'EMPLOYEE' | 'READ_ONLY';

interface CompanyRoleEntry { company_id: string; role: CompanyRole }

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null; // legacy single role (backward compatibility)
  globalRole: GlobalRole | null;
  companyRoles: CompanyRoleEntry[];
  activeCompanyId: string | null;
  setActiveCompany: (companyId: string | null) => void;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [globalRole, setGlobalRole] = useState<GlobalRole | null>(null);
  const [companyRoles, setCompanyRoles] = useState<CompanyRoleEntry[]>([]);
  const [activeCompanyId, _setActiveCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setActiveCompany = (companyId: string | null) => {
    _setActiveCompanyId(companyId);
    try {
      if (companyId) localStorage.setItem('active_company_id', companyId);
      else localStorage.removeItem('active_company_id');
    } catch {}
  };

  const loadActiveCompanyFromStorage = () => {
    try {
      const stored = localStorage.getItem('active_company_id');
      if (stored) _setActiveCompanyId(stored);
    } catch {}
  };

  const fetchUserRoles = async (userId: string) => {
    // Legacy single role (lowercase)
    try {
      const { data } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      if (data?.role) {
        setRole(data.role as AppRole);
      } else {
        setRole(null);
      }
    } catch {
      // If table or query fails, keep safe defaults
      setRole(null);
      setGlobalRole(null);
    }

    // Global roles (e.g. SUPER_ADMIN)
    try {
      const { data: globalRoles } = await supabase
        .from('user_global_roles' as any)
        .select('role')
        .eq('user_id', userId);

      const roles = (globalRoles as any[] | null) ?? [];
      const isSuperAdmin = roles.some((r) => String(r.role).toUpperCase() === 'SUPER_ADMIN');
      setGlobalRole(isSuperAdmin ? 'SUPER_ADMIN' : 'USER');
    } catch {
      setGlobalRole('USER');
    }

    // Per-company roles
    try {
      const { data: ucr } = await supabase
        .from('user_company_roles' as any)
        .select('company_id, role')
        .eq('user_id', userId);
      if (ucr && Array.isArray(ucr)) {
        setCompanyRoles(
          ucr.map((r: any) => ({ company_id: r.company_id, role: r.role as CompanyRole }))
        );
        // Initialize active company if not set
        if (!activeCompanyId && ucr.length > 0) {
          setActiveCompany(ucr[0].company_id);
        }
      } else {
        setCompanyRoles([]);
      }
    } catch {
      setCompanyRoles([]);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            loadActiveCompanyFromStorage();
            fetchUserRoles(session.user.id);
          }, 0);
        } else {
          setRole(null);
          setGlobalRole(null);
          setCompanyRoles([]);
          setActiveCompany(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadActiveCompanyFromStorage();
        fetchUserRoles(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName }
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setGlobalRole(null);
    setCompanyRoles([]);
    setActiveCompany(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, globalRole, companyRoles, activeCompanyId, setActiveCompany, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
