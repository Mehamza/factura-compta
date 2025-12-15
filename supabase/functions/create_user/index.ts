// Deno Edge Function: create_user
// Securely creates a Supabase auth user and assigns an app role, enforcing global email uniqueness.
// Request body: { full_name: string, email: string, password: string, role: 'manager'|'accountant'|'cashier'|'admin' }
// Only callers with Admin or Manager role are allowed; Managers cannot create Admin users.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-actor-role',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const headers = Object.fromEntries(req.headers.entries());
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const body = await req.json();
    const { full_name, email, password, role } = body || {};
    if (!full_name || !email || !password) {
      return new Response(JSON.stringify({ error: 'Nom, email et mot de passe sont obligatoires.' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determine caller role via header
    const actorRole = (headers['x-actor-role'] || '').toLowerCase();
    const targetRole = (role || 'cashier').toLowerCase();
    
    if (!(actorRole === 'admin' || actorRole === 'manager')) {
      return new Response(JSON.stringify({ error: "Vous n'avez pas l'autorisation d'effectuer cette action." }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (actorRole === 'manager' && targetRole === 'admin') {
      return new Response(JSON.stringify({ error: "Un gérant ne peut pas créer un administrateur." }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Call admin API using service role to enforce uniqueness and create auth user
    const adminAuthResp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name } }),
    });

    const adminAuthData = await adminAuthResp.json();
    if (!adminAuthResp.ok) {
      console.error('Auth creation failed:', adminAuthData);
      return new Response(JSON.stringify({ error: "Cet email est déjà utilisé dans l'application. Un utilisateur ne peut avoir qu'un seul compte." }), { 
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
      body: JSON.stringify({ user_id: createdUserId, full_name, email }),
    });
    if (!profileResp.ok) {
      const err = await profileResp.text();
      console.error('Profile creation failed:', err);
      return new Response(JSON.stringify({ error: "Impossible de créer le profil." }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Assign role
    const roleResp = await fetch(`${supabaseUrl}/rest/v1/user_roles`, {
      method: 'POST',
      headers: postgrestHeaders,
      body: JSON.stringify({ user_id: createdUserId, role: targetRole }),
    });
    if (!roleResp.ok) {
      const err = await roleResp.text();
      console.error('Role assignment failed:', err);
      return new Response(JSON.stringify({ error: "Impossible d'assigner le rôle." }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true, user_id: createdUserId }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('Server error:', e);
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
