// Gatekeeper for blood_bag_transactions — the only table in this app that
// holds real patient PHI (patient_name, patient_mrn). RLS on that table
// denies the public anon key entirely; every read/write goes through here,
// authenticated with the session token issued by the `auth` function.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { requireSession } from "./_shared/session.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

const ADMIN_ROLES = ["admin", "super", "owner"];

// Matches exactly the fields BloodBagTransactions.jsx's saveRecord() builds
// — an authenticated caller can't smuggle extra columns (or override
// `locked`) into the PHI table through a hand-crafted request.
const RECORD_FIELDS = [
  "bag_number", "blood_type", "component_type", "expiry_date", "action",
  "reason", "patient_name", "patient_mrn", "dispensed_department",
  "txn_date", "performed_by", "note",
];

function sanitizeRecord(record: any): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const field of RECORD_FIELDS) {
    if (record && field in record) clean[field] = record[field];
  }
  clean.locked = true;
  return clean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const session = await requireSession(body?.token, SERVICE_ROLE_KEY);
  if (!session) return json({ error: "Your session has expired. Please sign in again." }, 401);

  const { action } = body;

  if (action === "list") {
    const { data, error } = await admin.from("blood_bag_transactions").select("*").order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 500);
    return json({ rows: data || [] });
  }

  if (action === "insert") {
    const { error } = await admin.from("blood_bag_transactions").insert(sanitizeRecord(body.record));
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  if (action === "update") {
    if (!ADMIN_ROLES.includes(session.role)) return json({ error: "Not authorized." }, 403);
    const { id, record } = body;
    if (!id) return json({ error: "Missing id." }, 400);
    const { error } = await admin.from("blood_bag_transactions").update(sanitizeRecord(record)).eq("id", id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  if (action === "delete") {
    if (!ADMIN_ROLES.includes(session.role)) return json({ error: "Not authorized." }, 403);
    const { id } = body;
    if (!id) return json({ error: "Missing id." }, 400);
    const { error } = await admin.from("blood_bag_transactions").delete().eq("id", id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return json({ error: "Unknown action." }, 400);
});
