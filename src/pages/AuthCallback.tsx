import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

function parseHashParams(hash: string) {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  return new URLSearchParams(raw);
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const run = async () => {
      try {
        const type = searchParams.get('type');
        const code = searchParams.get('code');
        const tokenHash = searchParams.get('token_hash');

        // 1) PKCE/code flow
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        // 2) OTP verify flow (token_hash + type)
        if (!code && tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            type: type as any,
            token_hash: tokenHash,
          });
          if (error) throw error;
        }

        // 3) Legacy implicit flow (access_token/refresh_token in URL hash)
        if (!code && !(tokenHash && type)) {
          const hashParams = parseHashParams(window.location.hash);
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
          }
        }

        if (type === 'recovery') {
          navigate('/auth?mode=reset', { replace: true });
          return;
        }

        navigate('/dashboard', { replace: true });
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Lien invalide',
          description: e?.message ?? "Impossible de finaliser l'authentification",
        });
        navigate('/auth', { replace: true });
      }
    };

    void run();
  }, [navigate, searchParams, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-sm text-muted-foreground">Finalisation de la connexion…</div>
    </div>
  );
}
