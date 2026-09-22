// Handles every operation that used to touch app_config's owner/super/admin/lab
// credential columns or the staff_accounts table directly from the browser.
// Those columns are plaintext and were readable by anyone holding the public
// anon key (which ships inside the built frontend bundle) — this function
// is the only thing that talks to them now, using the service-role key that
// never leaves the server.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { hashPassword, issueSessionToken, requireSession, signToken, verifyPassword, verifyToken } from "./_shared/session.ts";

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

const STAFF_ROLES = ["staff", "admin", "super", "owner"];
const MANAGE_STAFF_ROLES = ["admin", "super", "owner"];

// ---- action handlers ----

async function handleLogin(body: any) {
  const { username, password } = body;
  if (!username || !password) return json({ error: "Username and password are required." }, 400);

  const { data: cfg } = await admin
    .from("app_config")
    .select("owner_username, owner_password, super_username, super_password, admin_username, admin_password, lab_username, lab_password")
    .eq("id", 1)
    .maybeSingle();

  if (cfg) {
    const hardcoded: [string, string, string][] = [
      [cfg.owner_username, cfg.owner_password, "owner"],
      [cfg.super_username, cfg.super_password, "super"],
      [cfg.admin_username, cfg.admin_password, "admin"],
      [cfg.lab_username, cfg.lab_password, "staff"],
    ];
    for (const [u, p, role] of hardcoded) {
      if (u && p && u === username && p === password) {
        const token = await issueSessionToken(username, role, username, SERVICE_ROLE_KEY);
        return json({ token, role, name: username, mustChangePassword: false });
      }
    }
  }

  const { data: staff } = await admin.from("staff_accounts").select("*").eq("username", username).maybeSingle();
  if (!staff || !(await verifyPassword(password, staff.password))) {
    return json({ error: "Incorrect username or password." }, 401);
  }

  // Lazy-migrate a legacy plaintext password to a salted hash now that we
  // know it's correct, so the plaintext value stops existing at rest.
  if (!String(staff.password || "").startsWith("pbkdf2$")) {
    await admin.from("staff_accounts").update({ password: await hashPassword(password) }).eq("id", staff.id);
  }

  const role = STAFF_ROLES.includes(staff.role) ? staff.role : "staff";
  const name = staff.display_name || staff.username;

  if (staff.must_change_password) {
    const now = Math.floor(Date.now() / 1000);
    const setupToken = await signToken({ sub: staff.id, role, name, purpose: "password-setup", iat: now, exp: now + 15 * 60 }, SERVICE_ROLE_KEY);
    return json({ mustChangePassword: true, setupToken, name });
  }

  const token = await issueSessionToken(String(staff.id), role, name, SERVICE_ROLE_KEY);
  return json({ token, role, name, mustChangePassword: false });
}

async function handleSetInitialPassword(body: any) {
  const { setupToken, newPassword } = body;
  const payload = await verifyToken(setupToken, SERVICE_ROLE_KEY);
  if (!payload || payload.purpose !== "password-setup") return json({ error: "This setup link has expired. Please sign in again." }, 401);
  if (!newPassword || newPassword.length < 4) return json({ error: "Choose a password at least 4 characters long." }, 400);

  const { data: staff } = await admin.from("staff_accounts").select("username").eq("id", payload.sub).maybeSingle();
  if (staff && newPassword === staff.username) {
    return json({ error: "Pick something other than your employee number." }, 400);
  }

  const { error } = await admin
    .from("staff_accounts")
    .update({ password: await hashPassword(newPassword), must_change_password: false })
    .eq("id", payload.sub);
  if (error) return json({ error: "Could not save the new password. Try again." }, 500);

  const token = await issueSessionToken(payload.sub, payload.role, payload.name, SERVICE_ROLE_KEY);
  return json({ token, role: payload.role, name: payload.name });
}

async function handleChangeOwnPassword(body: any) {
  const session = await requireSession(body?.token, SERVICE_ROLE_KEY);
  if (!session) return json({ error: "Your session has expired. Please sign in again." }, 401);
  const { currentPassword, newPassword } = body;
  if (!newPassword || newPassword.length < 4) return json({ error: "Choose a password at least 4 characters long." }, 400);

  const { data: staff, error: lookupError } = await admin.from("staff_accounts").select("*").eq("display_name", session.name).maybeSingle();
  if (lookupError) return json({ error: "More than one account matches your name — ask an owner to change your password in Settings." }, 400);
  if (!staff) return json({ error: "This account isn't managed here — ask an owner to change it in Settings." }, 400);
  if (!(await verifyPassword(currentPassword, staff.password))) return json({ error: "Current password is incorrect." }, 400);

  const { error } = await admin.from("staff_accounts").update({ password: await hashPassword(newPassword), must_change_password: false }).eq("id", staff.id);
  if (error) return json({ error: "Could not save the new password." }, 500);
  return json({ ok: true });
}

async function handleListStaff(body: any) {
  const session = await requireSession(body?.token, SERVICE_ROLE_KEY);
  if (!session || !MANAGE_STAFF_ROLES.includes(session.role)) return json({ error: "Not authorized." }, 403);
  const { data, error } = await admin.from("staff_accounts").select("id, username, display_name, role, must_change_password").order("username");
  if (error) return json({ error: error.message }, 500);
  return json({ staff: data || [] });
}

async function handleAddStaff(body: any) {
  const session = await requireSession(body?.token, SERVICE_ROLE_KEY);
  if (!session || !MANAGE_STAFF_ROLES.includes(session.role)) return json({ error: "Not authorized." }, 403);
  const { display_name, username, password } = body;
  if (!display_name || !username || !password) return json({ error: "Name, username, and password are required." }, 400);
  const { error } = await admin.from("staff_accounts").insert({ display_name, username, password: await hashPassword(password), role: "staff" });
  if (error) return json({ error: "That username may already exist." }, 400);
  return json({ ok: true });
}

async function handleRemoveStaff(body: any) {
  const session = await requireSession(body?.token, SERVICE_ROLE_KEY);
  if (!session || !MANAGE_STAFF_ROLES.includes(session.role)) return json({ error: "Not authorized." }, 403);
  const { id } = body;
  if (!id) return json({ error: "Missing id." }, 400);
  const { error } = await admin.from("staff_accounts").delete().eq("id", id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

async function handleUpdateStaffRole(body: any) {
  const session = await requireSession(body?.token, SERVICE_ROLE_KEY);
  if (!session || session.role !== "owner") return json({ error: "Not authorized." }, 403);
  const { id, role } = body;
  if (!id || !STAFF_ROLES.includes(role)) return json({ error: "Invalid request." }, 400);
  const { error } = await admin.from("staff_accounts").update({ role }).eq("id", id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

const CONFIG_FIELD_VISIBILITY: Record<string, string[]> = {
  lab_username: MANAGE_STAFF_ROLES, lab_password: MANAGE_STAFF_ROLES,
  admin_username: MANAGE_STAFF_ROLES, admin_password: MANAGE_STAFF_ROLES,
  super_username: ["super", "owner"], super_password: ["super", "owner"],
  owner_username: ["owner"], owner_password: ["owner"],
};

async function handleGetCredentials(body: any) {
  const session = await requireSession(body?.token, SERVICE_ROLE_KEY);
  if (!session || !MANAGE_STAFF_ROLES.includes(session.role)) return json({ error: "Not authorized." }, 403);
  const { data, error } = await admin.from("app_config").select(Object.keys(CONFIG_FIELD_VISIBILITY).join(", ")).eq("id", 1).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  const visible: Record<string, unknown> = {};
  for (const [field, roles] of Object.entries(CONFIG_FIELD_VISIBILITY)) {
    if (roles.includes(session.role)) visible[field] = (data as any)?.[field] ?? "";
  }
  return json({ credentials: visible });
}

async function handleUpdateCredentials(body: any) {
  const session = await requireSession(body?.token, SERVICE_ROLE_KEY);
  if (!session || !MANAGE_STAFF_ROLES.includes(session.role)) return json({ error: "Not authorized." }, 403);
  const updates: Record<string, unknown> = {};
  for (const [field, roles] of Object.entries(CONFIG_FIELD_VISIBILITY)) {
    // Blank strings are never written — the client always fetches the
    // current values via getCredentials before showing this form, but if
    // that fetch hasn't landed yet (or failed) we must not let an empty
    // draft silently wipe out real, working login credentials.
    if (roles.includes(session.role) && field in body && body[field] !== "") updates[field] = body[field];
  }
  if (Object.keys(updates).length === 0) return json({ error: "Nothing to update." }, 400);
  const { error } = await admin.from("app_config").update(updates).eq("id", 1);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
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

  switch (body?.action) {
    case "login": return handleLogin(body);
    case "setInitialPassword": return handleSetInitialPassword(body);
    case "changeOwnPassword": return handleChangeOwnPassword(body);
    case "listStaff": return handleListStaff(body);
    case "addStaff": return handleAddStaff(body);
    case "removeStaff": return handleRemoveStaff(body);
    case "updateStaffRole": return handleUpdateStaffRole(body);
    case "getCredentials": return handleGetCredentials(body);
    case "updateCredentials": return handleUpdateCredentials(body);
    default: return json({ error: "Unknown action." }, 400);
  }
});
