import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'accountant' | 'manager' | 'cashier';
type GlobalRole = 'SUPER_ADMIN';
type CompanyRole = 'COMPANY_ADMIN' | 'ACCOUNTANT' | 'CASHIER' | 'EMPLOYEE' | 'READ_ONLY';

interface CompanyRoleEntry { company_id: string; role: CompanyRole }

// Impersonation state stored separately from auth session
interface ImpersonationState {
  isImpersonating: boolean;
  originalUser: User | null;
  originalSession: Session | null;
  targetUser: {
    id: string;
    email: string;
    profile: any;
    legacy_role: AppRole | null;
    global_roles: string[];
  } | null;
}

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
  // Impersonation methods (Super Admin only)
  isImpersonating: boolean;
  impersonatedUser: ImpersonationState['targetUser'];
  startImpersonation: (targetUserId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
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
  
  // Impersonation state
  const [impersonation, setImpersonation] = useState<ImpersonationState>({
    isImpersonating: false,
    originalUser: null,
    originalSession: null,
    targetUser: null,
  });

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
        // Clear impersonation on logout
        setImpersonation({
          isImpersonating: false,
          originalUser: null,
          originalSession: null,
          targetUser: null,
        });
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
    // If impersonating, stop first
    if (impersonation.isImpersonating) {
      await stopImpersonation();
    }
    await supabase.auth.signOut();
    setRole(null);
    setGlobalRole(null);
    setCompanyRoles([]);
    setActiveCompany(null);
  };

  /**
   * Start impersonation of a target user (Super Admin only)
   * This calls the server-side edge function to validate and log the impersonation
   */
  const startImpersonation = async (targetUserId: string) => {
    if (globalRole !== 'SUPER_ADMIN') {
      throw new Error('Only Super Admins can impersonate users');
    }
    
    if (!session?.access_token) {
      throw new Error('No active session');
    }

    // Call edge function to validate and log impersonation
    const response = await supabase.functions.invoke('impersonate_user', {
      body: { target_user_id: targetUserId, action: 'start' },
    });

    if (response.error) throw response.error;
    if (response.data?.error) throw new Error(response.data.error);

    const { target_user } = response.data;

    // Store original session and apply target user's permissions
    setImpersonation({
      isImpersonating: true,
      originalUser: user,
      originalSession: session,
      targetUser: target_user,
    });

    // Override role with target user's role (no privilege escalation)
    setRole(target_user.legacy_role || null);
    
    // Never allow impersonated user to have Super Admin
    const targetIsSuperAdmin = (target_user.global_roles || []).some(
      (r: string) => r.toUpperCase() === 'SUPER_ADMIN'
    );
    setGlobalRole(targetIsSuperAdmin ? null : null); // Always null during impersonation
  };

  /**
   * Stop impersonation and restore original Super Admin session
   */
  const stopImpersonation = async () => {
    if (!impersonation.isImpersonating || !impersonation.targetUser) {
      return;
    }

    // Log the end of impersonation
    try {
      await supabase.functions.invoke('impersonate_user', {
        body: { target_user_id: impersonation.targetUser.id, action: 'end' },
      });
    } catch (e) {
      console.error('Error logging impersonation end:', e);
    }

    // Restore original user and session
    if (impersonation.originalUser) {
      setUser(impersonation.originalUser);
      await fetchUserRoles(impersonation.originalUser.id);
    }

    // Clear impersonation state
    setImpersonation({
      isImpersonating: false,
      originalUser: null,
      originalSession: null,
      targetUser: null,
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      role,
      globalRole,
      companyRoles,
      activeCompanyId,
      setActiveCompany,
      loading,
      signIn,
      signUp,
      signOut,
      // Impersonation
      isImpersonating: impersonation.isImpersonating,
      impersonatedUser: impersonation.targetUser,
      startImpersonation,
      stopImpersonation,
    }}>
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
