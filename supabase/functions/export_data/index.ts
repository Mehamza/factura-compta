// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Resource = "invoices" | "products" | "stock_movements";

function toCSV(rows: any[]): string {
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => escape(r[h])).join(","));
  }
  return lines.join("\n");
}

function badRequest(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { "content-type": "application/json" } });
}

function forbidden(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { status: 403, headers: { "content-type": "application/json" } });
}

function internal(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "content-type": "application/json" } });
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const resource = url.searchParams.get("resource") as Resource | null;
    if (!resource) return badRequest("Paramètre 'resource' requis (invoices|products|stock_movements)");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return forbidden("Jeton manquant");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return forbidden("Authentification invalide");

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!roleData || roleData.role !== "admin") return forbidden("Action réservée à l'administrateur");

    let query = supabase.from(resource).select("*");
    const { data, error } = await query.limit(2000);
    if (error) return internal(error.message);

    const csv = toCSV(data || []);
    const filename = `${resource}_${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename=${filename}`,
        "cache-control": "no-store",
      },
    });
  } catch (e: unknown) {
    const error = e as Error;
    return internal(error?.message || "Erreur interne");
  }
});
