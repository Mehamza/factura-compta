type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appOrigin?: string;
};

function required(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(`[env] Missing required env var: ${name}`);
  }
  return value;
}

export function getPublicEnv(): PublicEnv {
  const supabaseUrl = required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL);

  const supabaseAnonKey = (
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );
  const resolvedAnonKey = required(
    'VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)',
    supabaseAnonKey,
  );

  const appOrigin = import.meta.env.VITE_APP_ORIGIN;

  return {
    supabaseUrl,
    supabaseAnonKey: resolvedAnonKey,
    appOrigin: appOrigin && appOrigin.trim() ? appOrigin : undefined,
  };
}

// Convenience singleton. Importing this will fail-fast during app startup.
export const env = getPublicEnv();
