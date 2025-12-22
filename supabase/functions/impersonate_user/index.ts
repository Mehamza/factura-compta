import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the authorization header to identify the caller
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get caller's user from the JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify caller is SUPER_ADMIN
    const { data: globalRoles } = await supabaseAdmin
      .from('user_global_roles')
      .select('role')
      .eq('user_id', caller.id);
    
    const isSuperAdmin = (globalRoles || []).some(
      (r: any) => String(r.role).toUpperCase() === 'SUPER_ADMIN'
    );
    
    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Super Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { target_user_id, action } = await req.json();

    if (!target_user_id || !action || !['start', 'end'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: target_user_id and action (start/end) required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get target user info
    const { data: targetUser, error: targetError } = await supabaseAdmin.auth.admin.getUserById(target_user_id);
    
    if (targetError || !targetUser?.user) {
      return new Response(
        JSON.stringify({ error: 'Target user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get target user's profile
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', target_user_id)
      .maybeSingle();

    // Get target user's roles
    const { data: targetLegacyRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', target_user_id)
      .maybeSingle();

    const { data: targetGlobalRoles } = await supabaseAdmin
      .from('user_global_roles')
      .select('role')
      .eq('user_id', target_user_id);

    // Log the impersonation event
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await supabaseAdmin
      .from('impersonation_logs')
      .insert({
        super_admin_id: caller.id,
        target_user_id: target_user_id,
        action: action,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

    console.log(`Impersonation ${action}: Super Admin ${caller.email} -> User ${targetUser.user.email}`);

    // For 'start' action, generate a magic link to get a real session
    let magicLinkUrl: string | null = null;

    if (action === 'start') {
      // Generate a magic link for the target user - this creates a real Supabase session
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: targetUser.user.email!,
        options: {
          redirectTo: `${req.headers.get('origin') || supabaseUrl}/dashboard`,
        },
      });

      if (linkError) {
        console.error('Error generating magic link:', linkError);
        return new Response(
          JSON.stringify({ error: `Failed to generate impersonation link: ${linkError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // The action_link contains the magic link URL with the token
      magicLinkUrl = linkData.properties.action_link;
      console.log('Generated magic link for impersonation');
    }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        magic_link: magicLinkUrl,
        target_user: {
          id: targetUser.user.id,
          email: targetUser.user.email,
          profile: targetProfile,
          legacy_role: targetLegacyRole?.role || null,
          global_roles: (targetGlobalRoles || []).map((r: any) => r.role),
        },
        super_admin: {
          id: caller.id,
          email: caller.email,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in impersonate_user function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
