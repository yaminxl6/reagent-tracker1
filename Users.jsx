import React, { useState } from "react";
import { Users as UsersIcon, Plus, Trash2, KeyRound } from "lucide-react";
import { supabase } from "./supabaseClient";

const inputStyle = { width: "100%", border: "1px solid #C7D1CE", borderRadius: 7, padding: "9px 11px", fontSize: 14, marginTop: 4, boxSizing: "border-box" };
const labelStyle = { fontSize: 12.5, fontWeight: 600, color: "#516361" };

export default function Users({ staffAccounts, role, logActivity, reload }) {
  const [newStaff, setNewStaff] = useState({ display_name: "", username: "", password: "" });
  const [msg, setMsg] = useState("");
  const [resettingId, setResettingId] = useState(null);
  const [resetPw, setResetPw] = useState("");
  const isOwner = role === "owner";

  async function addStaffAccount() {
    if (!newStaff.username || !newStaff.password || !newStaff.display_name) return;
    const { error } = await supabase.from("staff_accounts").insert(newStaff);
    setMsg(error ? "That username may already exist." : "Account created.");
    if (!error) await logActivity?.("staff_add", "staff", `${newStaff.display_name} (${newStaff.username})`);
    setNewStaff({ display_name: "", username: "", password: "" });
    reload();
    setTimeout(() => setMsg(""), 2500);
  }

  async function removeStaffAccount(id, uname) {
    if (!confirm("Remove this employee's account? They will no longer be able to sign in.")) return;
    await supabase.from("staff_accounts").delete().eq("id", id);
    await logActivity?.("staff_remove", "staff", uname);
    reload();
  }

  async function updateStaffRole(id, uname, newRole) {
    await supabase.from("staff_accounts").update({ role: newRole }).eq("id", id);
    await logActivity?.("staff_role_change", "staff", `${uname} → ${newRole}`);
    reload();
  }

  async function resetStaffPassword(id, uname) {
    if (!resetPw || resetPw.length < 4) {
      setMsg("Choose a temporary password at least 4 characters long.");
      return;
    }
    await supabase.from("staff_accounts").update({ password: resetPw, must_change_password: true }).eq("id", id);
    await logActivity?.("staff_password_reset", "staff", uname);
    setResettingId(null);
    setResetPw("");
    setMsg("Password reset. They'll be asked to set a new one at their next sign-in.");
    reload();
    setTimeout(() => setMsg(""), 3500);
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><UsersIcon size={20} /> Users</h2>
      <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 20 }}>
        Individual employee logins. Username/password can be their employee number — records always show their real name, never the login itself.
      </div>

      <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Add employee</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Real name (shown on records)"
            value={newStaff.display_name}
            onChange={(e) => setNewStaff((s) => ({ ...s, display_name: e.target.value }))}
            style={{ ...inputStyle, flex: 2, minWidth: 180, marginTop: 0 }}
          />
          <input
            placeholder="Username (e.g. employee number)"
            value={newStaff.username}
            onChange={(e) => setNewStaff((s) => ({ ...s, username: e.target.value }))}
            style={{ ...inputStyle, flex: 1, minWidth: 140, marginTop: 0 }}
          />
          <input
            placeholder="Password"
            value={newStaff.password}
            onChange={(e) => setNewStaff((s) => ({ ...s, password: e.target.value }))}
            style={{ ...inputStyle, flex: 1, minWidth: 140, marginTop: 0 }}
          />
          <button onClick={addStaffAccount} style={{ background: "var(--accent-1)", color: "#fff", border: "none", borderRadius: 7, padding: "0 16px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={14} /> Add
          </button>
        </div>
        {msg && <div style={{ fontSize: 12, color: "#516361", marginTop: 8 }}>{msg}</div>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(staffAccounts || []).length === 0 && <div style={{ fontSize: 13, color: "#8A9694" }}>No employee accounts yet.</div>}
        {(staffAccounts || []).map((s) => (
          <div key={s.id} style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{s.display_name || s.username}</div>
                <div style={{ fontSize: 12, color: "#8A9694" }}>login: {s.username}</div>
              </div>
              {isOwner ? (
                <select value={s.role || "staff"} onChange={(e) => updateStaffRole(s.id, s.display_name || s.username, e.target.value)} style={{ ...inputStyle, width: 120, marginTop: 0 }}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="super">Super</option>
                </select>
              ) : (
                <span style={{ fontSize: 12, color: "#8A9694", textTransform: "capitalize", background: "#F0F3F2", padding: "5px 10px", borderRadius: 6 }}>{s.role || "staff"}</span>
              )}
              {isOwner && (
                <button
                  onClick={() => { setResettingId(resettingId === s.id ? null : s.id); setResetPw(""); }}
                  title="Reset password"
                  style={{ background: "none", border: "none", color: "#0F7173" }}
                ><KeyRound size={15} /></button>
              )}
              <button onClick={() => removeStaffAccount(s.id, s.display_name || s.username)} style={{ background: "none", border: "none", color: "#C1432B" }}><Trash2 size={15} /></button>
            </div>
            {resettingId === s.id && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid #EDEFF2" }}>
                <input
                  placeholder="New temporary password"
                  value={resetPw}
                  onChange={(e) => setResetPw(e.target.value)}
                  style={{ ...inputStyle, flex: 1, marginTop: 0 }}
                />
                <button onClick={() => resetStaffPassword(s.id, s.display_name || s.username)} style={{ background: "#0F7173", color: "#fff", border: "none", borderRadius: 7, padding: "9px 14px", fontWeight: 700, fontSize: 12.5 }}>Reset</button>
                <button onClick={() => { setResettingId(null); setResetPw(""); }} style={{ background: "none", border: "1px solid #C7D1CE", borderRadius: 7, padding: "9px 12px", fontSize: 12.5 }}>Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
