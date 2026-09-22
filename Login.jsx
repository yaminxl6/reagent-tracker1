import React, { useState } from "react";
import { Beaker, Lock, KeyRound } from "lucide-react";
import { authCall } from "./authClient";

const inputStyle = { width: "100%", border: "1px solid #C7D1CE", borderRadius: 7, padding: "9px 11px", fontSize: 14, marginTop: 4, boxSizing: "border-box" };

export default function Login({ config, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingSetup, setPendingSetup] = useState(null); // { setupToken, name } — must set a new password first

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await authCall("login", { username, password });
      if (res.mustChangePassword) {
        setPendingSetup({ setupToken: res.setupToken, name: res.name });
        return;
      }
      onLogin(res.role, res.name, res.token);
    } catch (err) {
      setError(err.message || "Incorrect username or password.");
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingSetup) {
    return (
      <ChangePasswordScreen
        setupToken={pendingSetup.setupToken}
        name={pendingSetup.name}
        appName={config.app_name}
        appNameColor={config.app_name_color}
        onDone={(role, name, token) => onLogin(role, name, token)}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F0F3F2", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans', sans-serif", padding: 16 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');`}</style>
      <form onSubmit={submit} style={{ background: "#fff", borderRadius: 14, padding: 32, width: "100%", maxWidth: 360, border: "1px solid #E1E8E5" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <div style={{ background: "#1B2B2E", borderRadius: 8, padding: 8 }}>
            <Beaker size={20} color="#5FBFB0" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: config.app_name_color || "#1B2328" }}>{config.app_name || "Reagent Log"}</div>
            <div style={{ fontSize: 12, color: "#7B8E8A" }}>Rabia Hospital · Lab Inventory</div>
          </div>
        </div>

        <label style={{ fontSize: 12.5, fontWeight: 600, color: "#516361" }}>Username
          <input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </label>
        <label style={{ fontSize: 12.5, fontWeight: 600, color: "#516361", display: "block", marginTop: 12 }}>Password
          <input type="password" style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        {error && <div style={{ color: "#C1432B", fontSize: 12.5, marginTop: 10 }}>{error}</div>}

        <button type="submit" disabled={submitting} style={{ marginTop: 18, width: "100%", background: submitting ? "#8FA39E" : "#0F7173", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Lock size={14} /> {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

// Shown right after a correct first-time login (must_change_password is
// true on the account) — blocks entry into the app until a new password
// is set. The account's username itself never changes, only the password.
function ChangePasswordScreen({ setupToken, name, appName, appNameColor, onDone }) {
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!pw1 || pw1.length < 4) {
      setError("Choose a password at least 4 characters long.");
      return;
    }
    if (pw1 !== pw2) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      const res = await authCall("setInitialPassword", { setupToken, newPassword: pw1 });
      onDone(res.role, res.name, res.token);
    } catch (err) {
      setError(err.message || "Could not save the new password. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F0F3F2", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans', sans-serif", padding: 16 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');`}</style>
      <form onSubmit={submit} style={{ background: "#fff", borderRadius: 14, padding: 32, width: "100%", maxWidth: 360, border: "1px solid #E1E8E5" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ background: "#1B2B2E", borderRadius: 8, padding: 8 }}>
            <KeyRound size={20} color="#5FBFB0" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: appNameColor || "#1B2328" }}>{appName || "Reagent Log"}</div>
            <div style={{ fontSize: 12, color: "#7B8E8A" }}>First-time sign-in</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#516361", marginBottom: 18, background: "#EAF6F4", border: "1px solid #C6E8E3", borderRadius: 8, padding: "10px 12px" }}>
          Welcome, <b>{name}</b>. For security, set your own password before continuing — you won't use your employee number again after this.
        </div>

        <label style={{ fontSize: 12.5, fontWeight: 600, color: "#516361" }}>New password
          <input type="password" style={inputStyle} value={pw1} onChange={(e) => setPw1(e.target.value)} autoFocus />
        </label>
        <label style={{ fontSize: 12.5, fontWeight: 600, color: "#516361", display: "block", marginTop: 12 }}>Confirm new password
          <input type="password" style={inputStyle} value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </label>

        {error && <div style={{ color: "#C1432B", fontSize: 12.5, marginTop: 10 }}>{error}</div>}

        <button type="submit" disabled={saving} style={{ marginTop: 18, width: "100%", background: saving ? "#8FA39E" : "#0F7173", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Lock size={14} /> {saving ? "Saving…" : "Set password & continue"}
        </button>
      </form>
    </div>
  );
}
