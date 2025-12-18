// Deno Edge Function: create_user
// Securely creates a Supabase auth user and assigns an app role, enforcing global email uniqueness.
// Request body: { full_name: string, email: string, password: string, role: 'manager'|'accountant'|'cashier'|'admin' }
// Only callers with Admin or Manager role are allowed; Managers cannot create Admin users.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type AppRole = 'admin' | 'manager' | 'accountant' | 'cashier';

function parseAllowedOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeadersFor(origin: string | null, allowedOrigins: string[]) {
  const allowOrigin =
    !origin
      ? '*'
      : allowedOrigins.length === 0
        ? origin
        : allowedOrigins.includes(origin)
          ? origin
          : null;

  if (!allowOrigin) return null;

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(status: number, body: unknown, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const allowedOrigins = parseAllowedOrigins(Deno.env.get('ALLOWED_ORIGINS'));
  const corsHeaders = corsHeadersFor(origin, allowedOrigins);
  if (!corsHeaders) {
    return json(403, { error: 'Origin non autorisée' }, { 'Content-Type': 'application/json' });
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return json(405, { error: 'Méthode non autorisée' }, corsHeaders);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json(500, { error: 'Configuration serveur manquante' }, corsHeaders);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json(401, { error: 'Jeton manquant' }, corsHeaders);
    }

    // Identify the caller from the JWT (do NOT trust client headers)
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: callerErr,
    } = await callerClient.auth.getUser();

    if (callerErr || !caller) {
      return json(403, { error: 'Authentification invalide' }, corsHeaders);
    }

    const body = await req.json();
    const fullName = String(body?.full_name ?? '').trim();
    const emailRaw = String(body?.email ?? '').trim();
    const password = String(body?.password ?? '');
    const targetRoleRaw = String(body?.role ?? 'cashier').toLowerCase().trim();

    if (!fullName || !emailRaw || !password) {
      return json(400, { error: 'Nom, email et mot de passe sont obligatoires.' }, corsHeaders);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      return json(400, { error: 'Email invalide.' }, corsHeaders);
    }

    if (password.length < 8) {
      return json(400, { error: 'Mot de passe trop court (min 8 caractères).' }, corsHeaders);
    }

    const email = emailRaw.toLowerCase();
    const allowedTargetRoles: AppRole[] = ['admin', 'manager', 'accountant', 'cashier'];
    if (!allowedTargetRoles.includes(targetRoleRaw as AppRole)) {
      return json(400, { error: 'Rôle invalide.' }, corsHeaders);
    }

    // Determine caller role from DB (own role row)
    const { data: roleData, error: roleErr } = await callerClient
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .maybeSingle();
    if (roleErr || !roleData?.role) {
      return json(403, { error: "Vous n'avez pas l'autorisation d'effectuer cette action." }, corsHeaders);
    }

    const actorRole = String(roleData.role).toLowerCase();
    if (!(actorRole === 'admin' || actorRole === 'manager')) {
      return json(403, { error: "Vous n'avez pas l'autorisation d'effectuer cette action." }, corsHeaders);
    }
    if (actorRole === 'manager' && targetRoleRaw === 'admin') {
      return json(403, { error: 'Un gérant ne peut pas créer un administrateur.' }, corsHeaders);
    }

    // Call admin API using service role to enforce uniqueness and create auth user
    const adminAuthResp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }),
    });

    const adminAuthData = await adminAuthResp.json();
    if (!adminAuthResp.ok) {
      // Avoid leaking internal admin API payloads to clients
      return json(
        409,
        { error: "Cet email est déjà utilisé dans l'application. Un utilisateur ne peut avoir qu'un seul compte." },
        corsHeaders,
      );
    }

    const createdUserId = adminAuthData.id as string;

    // Insert profile and role with RLS bypass via service key (Postgrest)
    const postgrestHeaders = {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };

    // Create profile with email + full_name
    const profileResp = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: 'POST',
      headers: postgrestHeaders,
      body: JSON.stringify({ user_id: createdUserId, full_name: fullName, email }),
    });
    if (!profileResp.ok) {
      const err = await profileResp.text();

      // Backward-compat: if profiles.email doesn't exist, retry without it.
      if (err.toLowerCase().includes('column') && err.toLowerCase().includes('email') && err.toLowerCase().includes('does not exist')) {
        const retry = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
          method: 'POST',
          headers: postgrestHeaders,
          body: JSON.stringify({ user_id: createdUserId, full_name: fullName }),
        });
        if (!retry.ok) {
          return json(500, { error: 'Impossible de créer le profil.' }, corsHeaders);
        }
      } else {
        return json(500, { error: 'Impossible de créer le profil.' }, corsHeaders);
      }
    }

    // Assign role
    const roleResp = await fetch(`${supabaseUrl}/rest/v1/user_roles`, {
      method: 'POST',
      headers: postgrestHeaders,
      body: JSON.stringify({ user_id: createdUserId, role: targetRoleRaw }),
    });
    if (!roleResp.ok) {
      return json(500, { error: "Impossible d'assigner le rôle." }, corsHeaders);
    }

    return json(200, { ok: true, user_id: createdUserId }, corsHeaders);
  } catch (e) {
    return json(500, { error: 'Erreur serveur' }, corsHeaders);
  }
});
