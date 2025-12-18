import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'accountant' | 'manager' | 'cashier';
type GlobalRole = 'SUPER_ADMIN';
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
    } catch (error) {
      void error;
    }
  };

  const loadActiveCompanyFromStorage = () => {
    try {
      const stored = localStorage.getItem('active_company_id');
      if (stored) _setActiveCompanyId(stored);
    } catch (error) {
      void error;
    }
  };

  const fetchUserRoles = async (userId: string) => {
    let legacyRole: AppRole | null = null;

    // Legacy single role (lowercase)
    try {
      const { data } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      if (data?.role) {
        legacyRole = data.role as AppRole;
        setRole(legacyRole);
      } else {
        setRole(null);
      }
    } catch {
      setRole(null);
    }

    // Global roles (ONLY from user_global_roles)
    try {
      const { data: globalRoles } = await supabase
        .from('user_global_roles' as any)
        .select('role')
        .eq('user_id', userId);

      const roles = (globalRoles as any[] | null) ?? [];
      const isSuperAdmin = roles.some((r) => String(r.role).toUpperCase() === 'SUPER_ADMIN');
      setGlobalRole(isSuperAdmin ? 'SUPER_ADMIN' : null);
    } catch {
      // If the table is missing or query fails, default to USER (safe)
      setGlobalRole(null);
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
    const applySession = async (nextSession: Session | null) => {
      setLoading(true);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        loadActiveCompanyFromStorage();
        await fetchUserRoles(nextSession.user.id);
      } else {
        setRole(null);
        setGlobalRole(null);
        setCompanyRoles([]);
        setActiveCompany(null);
      }

      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      void applySession(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      void applySession(session);
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
