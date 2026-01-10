import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CompanyRole = "company_admin" | "gerant" | "comptable" | "caissier";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getCallerAndRole(supabaseAdmin: ReturnType<typeof createClient>, req: Request, companyId: string) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return { caller: null, role: null, error: json(401, { error: "Missing authorization header" }) };

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user: caller },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !caller) return { caller: null, role: null, error: json(401, { error: "Invalid token" }) };

  const { data: membership } = await supabaseAdmin
    .from("company_users")
    .select("role")
    .eq("user_id", caller.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!membership?.role) return { caller: null, role: null, error: json(403, { error: "Forbidden: not in company" }) };

  return { caller, role: String(membership.role) as CompanyRole, error: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const company_id = String(body?.company_id || "");
    const warehouse_id = body?.warehouse_id ? String(body.warehouse_id) : null;
    const limit = Math.min(Math.max(Number(body?.limit ?? 200), 1), 500);

    if (!company_id) return json(400, { error: "Missing company_id" });

    const { error } = await getCallerAndRole(supabaseAdmin, req, company_id);
    if (error) return error;

    let query = supabaseAdmin
      .from("stock_movements")
      .select("id, created_at, product_id, movement_type, quantity, note, warehouse_id, source_warehouse_id, destination_warehouse_id, reference_type, reference_id")
      .eq("company_id", company_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (warehouse_id) {
      // movements impacting this warehouse: direct or transfer source/destination
      query = query.or(`warehouse_id.eq.${warehouse_id},source_warehouse_id.eq.${warehouse_id},destination_warehouse_id.eq.${warehouse_id}`);
    }

    const { data, error: qErr } = await query;
    if (qErr) return json(500, { error: qErr.message });

    return json(200, { data: data || [] });
  } catch (e: unknown) {
    const err = e as Error;
    return json(500, { error: err?.message || "Internal error" });
  }
});
