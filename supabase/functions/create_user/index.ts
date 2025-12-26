// Deno Edge Function: create_user
// Securely creates a Supabase auth user and assigns an app role, enforcing global email uniqueness.
// Request body: { full_name: string, email: string, password: string, role: 'manager'|'accountant'|'cashier'|'admin' }
// Only callers with Admin or Manager role are allowed; Managers cannot create Admin users.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type AppRole = 'admin' | 'manager' | 'accountant' | 'cashier';

// Permissive CORS - function is protected by JWT verification
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-actor-role',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  console.log('create_user: Request received', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return json(405, { error: 'Méthode non autorisée' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error('create_user: Missing server configuration');
      return json(500, { error: 'Configuration serveur manquante' });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('create_user: Missing authorization header');
      return json(401, { error: 'Jeton manquant' });
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
      console.error('create_user: Invalid authentication', callerErr);
      return json(403, { error: 'Authentification invalide' });
    }

    console.log('create_user: Caller authenticated', caller.id);

    const body = await req.json();
    const fullName = String(body?.full_name ?? '').trim();
    const emailRaw = String(body?.email ?? '').trim();
    const password = String(body?.password ?? '');
    const targetRoleRaw = String(body?.role ?? 'cashier').toLowerCase().trim();

    console.log('create_user: Creating user', { fullName, email: emailRaw, role: targetRoleRaw });

    if (!fullName || !emailRaw || !password) {
      return json(400, { error: 'Nom, email et mot de passe sont obligatoires.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      return json(400, { error: 'Email invalide.' });
    }

    if (password.length < 8) {
      return json(400, { error: 'Mot de passe trop court (min 8 caractères).' });
    }

    const email = emailRaw.toLowerCase();
    const allowedTargetRoles: AppRole[] = ['admin', 'manager', 'accountant', 'cashier'];
    if (!allowedTargetRoles.includes(targetRoleRaw as AppRole)) {
      return json(400, { error: 'Rôle invalide.' });
    }

    // Determine caller role from DB (own role row)
    const { data: roleData, error: roleErr } = await callerClient
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .maybeSingle();

    console.log('create_user: Caller role lookup', { roleData, roleErr });

    if (roleErr || !roleData?.role) {
      return json(403, { error: "Vous n'avez pas l'autorisation d'effectuer cette action." });
    }

    const actorRole = String(roleData.role).toLowerCase();
    if (!(actorRole === 'admin' || actorRole === 'manager')) {
      return json(403, { error: "Vous n'avez pas l'autorisation d'effectuer cette action." });
    }
    if (actorRole === 'manager' && targetRoleRaw === 'admin') {
      return json(403, { error: 'Un gérant ne peut pas créer un administrateur.' });
    }

    console.log('create_user: Creating auth user via admin API');

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
    console.log('create_user: Admin auth response', { ok: adminAuthResp.ok, status: adminAuthResp.status });

    if (!adminAuthResp.ok) {
      console.error('create_user: Failed to create auth user', adminAuthData);
      return json(409, { error: "Cet email est déjà utilisé dans l'application. Un utilisateur ne peut avoir qu'un seul compte." });
    }

    const createdUserId = adminAuthData.id as string;
    console.log('create_user: Auth user created', createdUserId);

    // Insert profile and role with RLS bypass via service key (Postgrest)
    // Use upsert to handle case where trigger already created the profile
    const postgrestHeaders = {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation',
    };

    // Create/update profile with email + full_name using upsert
    console.log('create_user: Upserting profile');
    const profileResp = await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=user_id`, {
      method: 'POST',
      headers: postgrestHeaders,
      body: JSON.stringify({ user_id: createdUserId, full_name: fullName, email }),
    });

    if (!profileResp.ok) {
      const err = await profileResp.text();
      console.error('create_user: Profile upsert failed', err);

      // Backward-compat: if profiles.email doesn't exist, retry without it.
      if (err.toLowerCase().includes('column') && err.toLowerCase().includes('email') && err.toLowerCase().includes('does not exist')) {
        const retry = await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=user_id`, {
          method: 'POST',
          headers: postgrestHeaders,
          body: JSON.stringify({ user_id: createdUserId, full_name: fullName }),
        });
        if (!retry.ok) {
          console.error('create_user: Profile retry failed');
          return json(500, { error: 'Impossible de créer le profil.' });
        }
      } else {
        return json(500, { error: 'Impossible de créer le profil.' });
      }
    }

    console.log('create_user: Profile created/updated');

    // Assign role using upsert
    console.log('create_user: Upserting role', targetRoleRaw);
    const roleResp = await fetch(`${supabaseUrl}/rest/v1/user_roles?on_conflict=user_id,role`, {
      method: 'POST',
      headers: postgrestHeaders,
      body: JSON.stringify({ user_id: createdUserId, role: targetRoleRaw }),
    });

    if (!roleResp.ok) {
      const roleErrText = await roleResp.text();
      console.error('create_user: Role assignment failed', roleErrText);
      return json(500, { error: "Impossible d'assigner le rôle." });
    }

    console.log('create_user: Role assigned successfully');

    return json(200, { ok: true, user_id: createdUserId });
  } catch (e) {
    console.error('create_user: Unexpected error', e);
    return json(500, { error: 'Erreur serveur' });
  }
});
