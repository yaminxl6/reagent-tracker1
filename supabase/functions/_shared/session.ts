// Shared by the auth and blood-bag edge functions — kept as one source
// file so a change to token format/expiry/signing can't drift between the
// two deployments (each deploy call still uploads its own copy, but both
// copies always come from this single file).
const encoder = new TextEncoder();

export function getSigningKey(serviceRoleKey: string): Promise<CryptoKey> {
  return crypto.subtle.digest("SHA-256", encoder.encode(serviceRoleKey + ":reagent-tracker-session")).then((material) =>
    crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])
  );
}

export function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function base64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export type SessionPayload = { sub: string; role: string; name: string; purpose?: string; iat: number; exp: number };

export async function signToken(payload: SessionPayload, serviceRoleKey: string): Promise<string> {
  const key = await getSigningKey(serviceRoleKey);
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  return `${body}.${base64url(sig)}`;
}

export async function verifyToken(token: string | undefined | null, serviceRoleKey: string): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const key = await getSigningKey(serviceRoleKey);
  const valid = await crypto.subtle.verify("HMAC", key, base64urlToBytes(sig), encoder.encode(body));
  if (!valid) return null;
  const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(body))) as SessionPayload;
  if (typeof payload.exp === "number" && Date.now() / 1000 > payload.exp) return null;
  return payload;
}

export function issueSessionToken(sub: string, role: string, name: string, serviceRoleKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signToken({ sub, role, name, iat: now, exp: now + 12 * 60 * 60 }, serviceRoleKey); // 12h session
}

// A session token (no `purpose`) is never accepted where a purpose-scoped
// token (e.g. "password-setup") is required, and vice versa.
export async function requireSession(token: string | undefined | null, serviceRoleKey: string): Promise<SessionPayload | null> {
  const payload = await verifyToken(token, serviceRoleKey);
  if (!payload || payload.purpose) return null;
  return payload;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const iterations = 100000;
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, 256);
  return `pbkdf2$${iterations}$${base64url(salt)}$${base64url(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  if (!stored.startsWith("pbkdf2$")) return stored === password; // legacy plaintext row, not migrated yet
  const [, iterStr, saltB64, hashB64] = stored.split("$");
  const iterations = parseInt(iterStr, 10);
  const salt = base64urlToBytes(saltB64);
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, 256);
  return base64url(new Uint8Array(bits)) === hashB64;
}
