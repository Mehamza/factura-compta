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

function canWriteThresholds(role: CompanyRole) {
  return role === "company_admin" || role === "gerant" || role === "comptable";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list");
    const company_id = String(body?.company_id || "");

    if (!company_id) return json(400, { error: "Missing company_id" });

    const { role, error } = await getCallerAndRole(supabaseAdmin, req, company_id);
    if (error) return error;

    if (action === "list") {
      const warehouse_id = body?.warehouse_id ? String(body.warehouse_id) : null;
      if (!warehouse_id) return json(400, { error: "Missing warehouse_id" });

      // Load all products of the company and left-join warehouse_products
      const { data: products, error: pErr } = await supabaseAdmin
        .from("products")
        .select("id, name, sku, min_stock")
        .eq("company_id", company_id)
        .order("name");

      if (pErr) return json(500, { error: pErr.message });

      const { data: wp, error: wpErr } = await supabaseAdmin
        .from("warehouse_products")
        .select("warehouse_id, product_id, quantity, min_quantity, max_quantity")
        .eq("warehouse_id", warehouse_id);

      if (wpErr) return json(500, { error: wpErr.message });

      const map = new Map((wp || []).map((r: any) => [String(r.product_id), r]));

      const rows = (products || []).map((p: any) => {
        const row = map.get(String(p.id));
        return {
          product_id: p.id,
          name: p.name,
          sku: p.sku,
          quantity: row ? Number(row.quantity || 0) : 0,
          min_quantity: row ? Number(row.min_quantity || 0) : 0,
          max_quantity: row?.max_quantity === null || row?.max_quantity === undefined ? null : Number(row.max_quantity),
          company_min_stock: p.min_stock,
        };
      });

      return json(200, { data: rows });
    }

    if (action === "set_thresholds") {
      if (!canWriteThresholds(role!)) return json(403, { error: "Forbidden" });

      const warehouse_id = String(body?.warehouse_id || "");
      const product_id = String(body?.product_id || "");
      const min_quantity = Number(body?.min_quantity ?? 0);
      const max_quantity = body?.max_quantity === null || body?.max_quantity === undefined || body?.max_quantity === ""
        ? null
        : Number(body.max_quantity);

      if (!warehouse_id) return json(400, { error: "Missing warehouse_id" });
      if (!product_id) return json(400, { error: "Missing product_id" });
      if (!Number.isFinite(min_quantity) || min_quantity < 0) return json(400, { error: "Invalid min_quantity" });
      if (max_quantity !== null && (!Number.isFinite(max_quantity) || max_quantity < 0)) return json(400, { error: "Invalid max_quantity" });
      if (max_quantity !== null && max_quantity < min_quantity) return json(400, { error: "max_quantity must be >= min_quantity" });

      // Ensure warehouse belongs to company
      const { data: wh, error: whErr } = await supabaseAdmin
        .from("warehouses")
        .select("id")
        .eq("company_id", company_id)
        .eq("id", warehouse_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (whErr) return json(500, { error: whErr.message });
      if (!wh) return json(404, { error: "Warehouse not found" });

      // Upsert thresholds (do not change quantity)
      const { data, error: upErr } = await supabaseAdmin
        .from("warehouse_products")
        .upsert(
          {
            warehouse_id,
            product_id,
            min_quantity,
            max_quantity,
          },
          { onConflict: "warehouse_id,product_id" },
        )
        .select("warehouse_id, product_id, quantity, min_quantity, max_quantity")
        .single();

      if (upErr) return json(400, { error: upErr.message });
      return json(200, { data });
    }

    return json(400, { error: `Unknown action: ${action}` });
  } catch (e: unknown) {
    const err = e as Error;
    return json(500, { error: err?.message || "Internal error" });
  }
});
