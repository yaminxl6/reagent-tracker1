import { supabase } from "./supabaseClient";

// Talks to the `auth` and `blood-bag` edge functions instead of the
// database directly. Credentials (staff passwords, the shared
// owner/super/admin/lab logins) and patient data in blood_bag_transactions
// no longer go through the anon key at all — only these two functions,
// running with the service-role key, can touch them.

async function invoke(fn, body) {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let message = error.message || "Request failed.";
    try {
      const parsed = await error.context.json();
      if (parsed?.error) message = parsed.error;
    } catch {
      // response wasn't JSON — fall back to the generic error above
    }
    throw new Error(message);
  }
  return data;
}

export function authCall(action, params = {}) {
  return invoke("auth", { action, ...params });
}

export function bloodBagCall(action, params = {}) {
  return invoke("blood-bag", { action, ...params });
}

const TOKEN_KEY = "reagent_session_token";
export const getSessionToken = () => localStorage.getItem(TOKEN_KEY) || "";
export const setSessionToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};
