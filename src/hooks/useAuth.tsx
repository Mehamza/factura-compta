import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'accountant' | 'manager' | 'cashier';
type GlobalRole = 'SUPER_ADMIN';
type CompanyRole = 'COMPANY_ADMIN' | 'ACCOUNTANT' | 'CASHIER' | 'EMPLOYEE' | 'READ_ONLY';

interface CompanyRoleEntry { company_id: string; role: CompanyRole }

// Keys for sessionStorage
const IMPERSONATION_ORIGINAL_SESSION_KEY = 'impersonation_original_session';
const IMPERSONATION_STATE_KEY = 'impersonation_state';

interface StoredOriginalSession {
  access_token: string;
  refresh_token: string;
  user_id: string;
  user_email: string;
}

interface StoredImpersonationState {
  isImpersonating: boolean;
  targetUser: {
    id: string;
    email: string;
    profile: any;
    legacy_role: AppRole | null;
    global_roles: string[];
  } | null;
  superAdminId: string;
  superAdminEmail: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
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
  impersonatedUser: StoredImpersonationState['targetUser'];
  originalSuperAdmin: { id: string; email: string } | null;
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
  
  // Impersonation state from sessionStorage
  const [impersonationState, setImpersonationState] = useState<StoredImpersonationState | null>(null);

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

  // Load impersonation state from sessionStorage on mount
  const loadImpersonationState = (): StoredImpersonationState | null => {
    try {
      const stored = sessionStorage.getItem(IMPERSONATION_STATE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading impersonation state:', error);
    }
    return null;
  };

  const saveImpersonationState = (state: StoredImpersonationState | null) => {
    try {
      if (state) {
        sessionStorage.setItem(IMPERSONATION_STATE_KEY, JSON.stringify(state));
      } else {
        sessionStorage.removeItem(IMPERSONATION_STATE_KEY);
      }
      setImpersonationState(state);
    } catch (error) {
      console.error('Error saving impersonation state:', error);
    }
  };

  const saveOriginalSession = (session: Session, user: User) => {
    try {
      const original: StoredOriginalSession = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user_id: user.id,
        user_email: user.email || '',
      };
      sessionStorage.setItem(IMPERSONATION_ORIGINAL_SESSION_KEY, JSON.stringify(original));
    } catch (error) {
      console.error('Error saving original session:', error);
    }
  };

  const getOriginalSession = (): StoredOriginalSession | null => {
    try {
      const stored = sessionStorage.getItem(IMPERSONATION_ORIGINAL_SESSION_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error getting original session:', error);
    }
    return null;
  };

  const clearImpersonationStorage = () => {
    try {
      sessionStorage.removeItem(IMPERSONATION_ORIGINAL_SESSION_KEY);
      sessionStorage.removeItem(IMPERSONATION_STATE_KEY);
    } catch (error) {
      console.error('Error clearing impersonation storage:', error);
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

    // Global roles (ONLY from user_global_roles) - but never set during impersonation
    const currentImpersonation = loadImpersonationState();
    if (!currentImpersonation?.isImpersonating) {
      try {
        const { data: globalRoles } = await supabase
          .from('user_global_roles' as any)
          .select('role')
          .eq('user_id', userId);

        const roles = (globalRoles as any[] | null) ?? [];
        const isSuperAdmin = roles.some((r) => String(r.role).toUpperCase() === 'SUPER_ADMIN');
        setGlobalRole(isSuperAdmin ? 'SUPER_ADMIN' : null);
      } catch {
        setGlobalRole(null);
      }
    } else {
      // During impersonation, never grant Super Admin role
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
    // Load impersonation state on mount
    const storedImpersonation = loadImpersonationState();
    if (storedImpersonation) {
      setImpersonationState(storedImpersonation);
    }

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
        clearImpersonationStorage();
        setImpersonationState(null);
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
    if (impersonationState?.isImpersonating) {
      await stopImpersonation();
    }
    await supabase.auth.signOut();
    setRole(null);
    setGlobalRole(null);
    setCompanyRoles([]);
    setActiveCompany(null);
    clearImpersonationStorage();
    setImpersonationState(null);
  };

  /**
   * Start impersonation of a target user (Super Admin only)
   * This generates a real JWT token for the target user
   */
  const startImpersonation = async (targetUserId: string) => {
    if (globalRole !== 'SUPER_ADMIN') {
      throw new Error('Only Super Admins can impersonate users');
    }
    
    if (!session?.access_token || !user) {
      throw new Error('No active session');
    }

    // Save the original session BEFORE making any changes
    saveOriginalSession(session, user);

    // Call edge function to validate and get JWT for target user
    const response = await supabase.functions.invoke('impersonate_user', {
      body: { target_user_id: targetUserId, action: 'start' },
    });

    if (response.error) {
      clearImpersonationStorage();
      throw response.error;
    }
    if (response.data?.error) {
      clearImpersonationStorage();
      throw new Error(response.data.error);
    }

    const { target_user, access_token, refresh_token, super_admin } = response.data;

    if (!access_token || !refresh_token) {
      clearImpersonationStorage();
      throw new Error('Failed to generate impersonation token');
    }

    // Save impersonation state
    const newImpersonationState: StoredImpersonationState = {
      isImpersonating: true,
      targetUser: target_user,
      superAdminId: super_admin.id,
      superAdminEmail: super_admin.email,
    };
    saveImpersonationState(newImpersonationState);

    // Apply the new session with target user's token
    // This will trigger onAuthStateChange and update the user/session
    const { error: setSessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (setSessionError) {
      clearImpersonationStorage();
      throw new Error(`Failed to set impersonation session: ${setSessionError.message}`);
    }

    // The onAuthStateChange will handle updating user/session/roles
    // But we need to ensure globalRole stays null during impersonation
    setGlobalRole(null);
  };

  /**
   * Stop impersonation and restore original Super Admin session
   */
  const stopImpersonation = async () => {
    const currentImpersonation = impersonationState || loadImpersonationState();
    
    if (!currentImpersonation?.isImpersonating) {
      return;
    }

    const originalSession = getOriginalSession();
    
    if (!originalSession) {
      console.error('No original session found');
      clearImpersonationStorage();
      setImpersonationState(null);
      // Force sign out as fallback
      await supabase.auth.signOut();
      return;
    }

    // Log the end of impersonation (use original token to authenticate)
    try {
      // Create a temporary client with the original session to log the end
      // Since we're still logged in as the target user, we need to use the original token
      const { createClient } = await import('@supabase/supabase-js');
      const tempClient = createClient(
        'https://njkgynqrobfyiqwzdbaz.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qa2d5bnFyb2JmeWlxd3pkYmF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMjUyOTcsImV4cCI6MjA4MDkwMTI5N30.Xa_YZBMi-NAqrJStjoZEYhyTrxx8ned3q3CUu3v2ASs',
        {
          global: {
            headers: {
              Authorization: `Bearer ${originalSession.access_token}`,
            },
          },
        }
      );
      
      await tempClient.functions.invoke('impersonate_user', {
        body: { target_user_id: currentImpersonation.targetUser?.id, action: 'end' },
      });
    } catch (e) {
      console.error('Error logging impersonation end:', e);
    }

    // Clear impersonation state first
    clearImpersonationStorage();
    setImpersonationState(null);

    // Restore original Super Admin session
    const { error: restoreError } = await supabase.auth.setSession({
      access_token: originalSession.access_token,
      refresh_token: originalSession.refresh_token,
    });

    if (restoreError) {
      console.error('Error restoring original session:', restoreError);
      // Force sign out as fallback
      await supabase.auth.signOut();
    }

    // The onAuthStateChange will handle updating user/session/roles
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
      isImpersonating: impersonationState?.isImpersonating || false,
      impersonatedUser: impersonationState?.targetUser || null,
      originalSuperAdmin: impersonationState?.isImpersonating 
        ? { id: impersonationState.superAdminId, email: impersonationState.superAdminEmail }
        : null,
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
