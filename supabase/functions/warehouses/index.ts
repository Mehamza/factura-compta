import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Keep compatibility with both legacy (FR) roles and current app roles.
type CompanyRole =
  | "admin"
  | "manager"
  | "accountant"
  | "cashier"
  | "company_admin"
  | "gerant"
  | "comptable"
  | "caissier";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getCallerAndRole(supabaseAdmin: any, req: Request, companyId: string) {
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

  const membershipRole = (membership as { role?: string } | null)?.role;
  if (!membershipRole) return { caller: null, role: null, error: json(403, { error: "Forbidden: not in company" }) };

  return { caller, role: String(membershipRole) as CompanyRole, error: null };
}

function canWrite(role: CompanyRole) {
  return role === "admin" || role === "manager" || role === "company_admin" || role === "gerant";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const company_id = String(body?.company_id || "");

    if (!action) return json(400, { error: "Missing action" });
    if (!company_id) return json(400, { error: "Missing company_id" });

    const { caller, role, error } = await getCallerAndRole(supabaseAdmin, req, company_id);
    if (error) return error;

    if (action === "list") {
      const { data, error: qErr } = await supabaseAdmin
        .from("warehouses")
        .select("*")
        .eq("company_id", company_id)
        .is("deleted_at", null)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });

      if (qErr) return json(500, { error: qErr.message });
      return json(200, { data: data || [] });
    }

    if (action === "get") {
      const id = String(body?.id || "");
      if (!id) return json(400, { error: "Missing id" });

      const { data, error: qErr } = await supabaseAdmin
        .from("warehouses")
        .select("*")
        .eq("company_id", company_id)
        .eq("id", id)
        .maybeSingle();

      if (qErr) return json(500, { error: qErr.message });
      if (!data) return json(404, { error: "Not found" });
      return json(200, { data });
    }

    if (action === "create" || action === "update") {
      if (!canWrite(role!)) return json(403, { error: "Forbidden" });

      const payload = {
        company_id,
        code: String(body?.code || "").trim(),
        name: String(body?.name || "").trim(),
        address: body?.address ? String(body.address).trim() : null,
        city: body?.city ? String(body.city).trim() : null,
        country: body?.country ? String(body.country).trim() : null,
        manager_name: body?.manager_name ? String(body.manager_name).trim() : null,
        manager_phone: body?.manager_phone ? String(body.manager_phone).trim() : null,
        is_default: Boolean(body?.is_default || false),
        is_active: body?.is_active === undefined ? true : Boolean(body.is_active),
      };

      if (!payload.code) return json(400, { error: "code is required" });
      if (!payload.name) return json(400, { error: "name is required" });

      if (action === "create") {
        const { data, error: insErr } = await supabaseAdmin
          .from("warehouses")
          .insert(payload)
          .select("*")
          .single();

        if (insErr) return json(400, { error: insErr.message });
        return json(200, { data });
      }

      const id = String(body?.id || "");
      if (!id) return json(400, { error: "Missing id" });

      const { data, error: updErr } = await supabaseAdmin
        .from("warehouses")
        .update(payload)
        .eq("company_id", company_id)
        .eq("id", id)
        .select("*")
        .single();

      if (updErr) return json(400, { error: updErr.message });
      return json(200, { data });
    }

    if (action === "delete") {
      if (!canWrite(role!)) return json(403, { error: "Forbidden" });

      const id = String(body?.id || "");
      if (!id) return json(400, { error: "Missing id" });

      const { data: wh, error: whErr } = await supabaseAdmin
        .from("warehouses")
        .select("id, is_default")
        .eq("company_id", company_id)
        .eq("id", id)
        .maybeSingle();

      if (whErr) return json(500, { error: whErr.message });
      if (!wh) return json(404, { error: "Not found" });
      if (wh.is_default) return json(400, { error: "Cannot delete default warehouse" });

      const { count, error: cErr } = await supabaseAdmin
        .from("warehouse_products")
        .select("id", { count: "exact", head: true })
        .eq("warehouse_id", id)
        .gt("quantity", 0);

      if (cErr) return json(500, { error: cErr.message });
      if ((count || 0) > 0) return json(400, { error: "Cannot delete warehouse with existing stock" });

      const { error: delErr } = await supabaseAdmin
        .from("warehouses")
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq("company_id", company_id)
        .eq("id", id);

      if (delErr) return json(500, { error: delErr.message });
      return json(200, { success: true });
    }

    return json(400, { error: `Unknown action: ${action}` });
  } catch (e: unknown) {
    const err = e as Error;
    return json(500, { error: err?.message || "Internal error" });
  }
});
