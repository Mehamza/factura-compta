import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CompanyRole = "company_admin" | "gerant" | "comptable" | "caissier";

type MovementKind = "IN" | "OUT" | "TRANSFER";

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

function canCreateMovement(role: CompanyRole) {
  return role === "company_admin" || role === "gerant" || role === "comptable";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const company_id = String(body?.company_id || "");
    const kind = String(body?.kind || "").toUpperCase() as MovementKind;
    const product_id = String(body?.product_id || "");
    const quantity = Number(body?.quantity);
    const warehouse_id = body?.warehouse_id ? String(body.warehouse_id) : null;
    const source_warehouse_id = body?.source_warehouse_id ? String(body.source_warehouse_id) : null;
    const destination_warehouse_id = body?.destination_warehouse_id ? String(body.destination_warehouse_id) : null;
    const reference_type = body?.reference_type ? String(body.reference_type) : null;
    const reference_id = body?.reference_id ? String(body.reference_id) : null;
    const note = body?.note ? String(body.note) : null;

    if (!company_id) return json(400, { error: "Missing company_id" });

    const { caller, role, error } = await getCallerAndRole(supabaseAdmin, req, company_id);
    if (error) return error;

    if (!canCreateMovement(role!)) return json(403, { error: "Forbidden" });

    if (!product_id) return json(400, { error: "Missing product_id" });
    if (!kind || !["IN", "OUT", "TRANSFER"].includes(kind)) return json(400, { error: "Invalid kind" });
    if (!Number.isFinite(quantity) || quantity <= 0) return json(400, { error: "Invalid quantity" });

    if ((kind === "IN" || kind === "OUT") && !warehouse_id) {
      return json(400, { error: "warehouse_id required" });
    }

    if (kind === "TRANSFER" && (!source_warehouse_id || !destination_warehouse_id)) {
      return json(400, { error: "source_warehouse_id and destination_warehouse_id required" });
    }

    const { data: movementId, error: rpcErr } = await supabaseAdmin.rpc("apply_warehouse_stock_movement", {
      p_company_id: company_id,
      p_user_id: caller!.id,
      p_kind: kind,
      p_product_id: product_id,
      p_quantity: quantity,
      p_warehouse_id: warehouse_id,
      p_source_warehouse_id: source_warehouse_id,
      p_destination_warehouse_id: destination_warehouse_id,
      p_reference_type: reference_type,
      p_reference_id: reference_id,
      p_note: note,
    });

    if (rpcErr) return json(400, { error: rpcErr.message });

    return json(200, { id: movementId });
  } catch (e: unknown) {
    const err = e as Error;
    return json(500, { error: err?.message || "Internal error" });
  }
});
