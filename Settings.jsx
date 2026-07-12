import React, { useState } from "react";
import { Trash2, Plus, Save, Eye, EyeOff, Pencil } from "lucide-react";
import { supabase } from "./supabaseClient";

const THEME_PRESETS = [
  { name: "Ocean Teal", colors: { accent1: "#0F9B8E", accent2: "#3E6ACF", headerStart: "#123C4A", headerEnd: "#1B2B2E" } },
  { name: "Deep Navy",  colors: { accent1: "#3E6ACF", accent2: "#5FA8D3", headerStart: "#0B1F3A", headerEnd: "#132A4D" } },
  { name: "Emerald",    colors: { accent1: "#2F8F5B", accent2: "#0F9B8E", headerStart: "#0E3B2A", headerEnd: "#1B2B2E" } },
  { name: "Plum",       colors: { accent1: "#7A4FA3", accent2: "#B5473A", headerStart: "#2B1B3A", headerEnd: "#1B2B2E" } },
  { name: "Amber Slate",colors: { accent1: "#D8862B", accent2: "#3E6ACF", headerStart: "#2A2420", headerEnd: "#1B2B2E" } },
  { name: "Rose Gold",  colors: { accent1: "#B5473A", accent2: "#D8862B", headerStart: "#3A1F1B", headerEnd: "#1B2B2E" } },
  { name: "Sunset",     colors: { accent1: "#E8722C", accent2: "#D94F70", headerStart: "#4A1F2E", headerEnd: "#2A1420" } },
];

export default function Settings({ config, presets, role, staffAccounts, devices, reagents, logs, logActivity, reload }) {
  const [delDevice, setDelDevice] = useState("");
  const [delItem, setDelItem] = useState("");
  const [reFrom, setReFrom] = useState("");
  const [reTo, setReTo] = useState("");
  const [reOldStaff, setReOldStaff] = useState("");
  const [reNewStaff, setReNewStaff] = useState("");
  const [tnFrom, setTnFrom] = useState("");
  const [tnTo, setTnTo] = useState("");
  const [tnOldItem, setTnOldItem] = useState("");
  const [tnNewItem, setTnNewItem] = useState("");
  const [tnMsg, setTnMsg] = useState("");
  const [reMsg, setReMsg] = useState("");
  const [delFrom, setDelFrom] = useState("");
  const [delTo, setDelTo] = useState("");
  const [delMsg, setDelMsg] = useState("");
  const departments = config.departments || [];
  const [newPreset, setNewPreset] = useState({ name: "", department: departments[0] || "", unit: "mL" });
  const [newDept, setNewDept] = useState("");
  const [newDevice, setNewDevice] = useState({ name: "", department: departments[0] || "" });
  const [newStaff, setNewStaff] = useState({ username: "", password: "" });
  const [staffMsg, setStaffMsg] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [creds, setCreds] = useState({
    lab_username: config.lab_username,
    lab_password: config.lab_password,
    admin_username: config.admin_username,
    admin_password: config.admin_password,
    super_username: config.super_username,
    super_password: config.super_password,
    owner_username: config.owner_username,
    owner_password: config.owner_password,
    low_stock_default_percent: config.low_stock_default_percent,
    expiry_warning_days: config.expiry_warning_days ?? 30,
  });
  const [theme, setTheme] = useState(config.theme_colors || { accent1: "#0F9B8E", accent2: "#3E6ACF", headerStart: "#123C4A", headerEnd: "#1B2B2E" });
  const [themeMsg, setThemeMsg] = useState("");
  const [msg, setMsg] = useState("");

  async function saveTheme() {
    const { error } = await supabase.from("app_config").update({ theme_colors: theme }).eq("id", 1);
    setThemeMsg(error ? "Could not save." : "Saved — refresh to see it everywhere.");
    await logActivity?.("settings_change", "config", "Theme colors updated");
    reload();
    setTimeout(() => setThemeMsg(""), 3000);
  }

  const allDeviceNames = [...new Set([...(devices || []).map((d) => d.name), ...(reagents || []).map((r) => r.device).filter(Boolean)])];

  const matchingLots = (reagents || []).filter((r) =>
    (!delDevice || r.device === delDevice) &&
    (!delItem || r.name.toLowerCase().includes(delItem.trim().toLowerCase())) &&
    (!delFrom || r.date_added >= delFrom) &&
    (!delTo || r.date_added <= delTo)
  );
  const matchingLogs = (logs || []).filter((l) => {
    const lot = (reagents || []).find((r) => r.id === l.reagent_id);
    return (!delDevice || lot?.device === delDevice) &&
      (!delItem || lot?.name.toLowerCase().includes(delItem.trim().toLowerCase())) &&
      (!delFrom || l.date >= delFrom) && (!delTo || l.date <= delTo);
  });

  async function performDelete() {
    if (!delDevice && !delItem && !delFrom && !delTo) {
      setDelMsg("Pick at least a device, a test name, or a date range first — this would otherwise match everything.");
      return;
    }
    if (!confirm(`Delete ${matchingLots.length} reagent lot(s) and ${matchingLogs.length} usage log(s) matching this filter? This cannot be undone.`)) return;
    if (matchingLogs.length) await supabase.from("consumption_logs").delete().in("id", matchingLogs.map((l) => l.id));
    if (matchingLots.length) await supabase.from("reagents").delete().in("id", matchingLots.map((r) => r.id));
    await logActivity?.("bulk_import", "reagent", `Test-data cleanup: deleted ${matchingLots.length} lot(s), ${matchingLogs.length} log(s)${delDevice ? ` for ${delDevice}` : ""}${delItem ? ` matching "${delItem}"` : ""}${delFrom || delTo ? ` (${delFrom || "…"} to ${delTo || "…"})` : ""}`);
    setDelMsg(`Deleted ${matchingLots.length} lot(s) and ${matchingLogs.length} log(s).`);
    reload();
  }

  const allStaffNames = [...new Set([...(reagents || []).map((r) => r.added_by), ...(logs || []).map((l) => l.used_by)])].filter(Boolean).sort();

  const matchingReceivedBy = (reagents || []).filter((r) =>
    reOldStaff && r.added_by === reOldStaff &&
    (!reFrom || r.date_added >= reFrom) && (!reTo || r.date_added <= reTo)
  );
  const matchingUsedBy = (logs || []).filter((l) =>
    reOldStaff && l.used_by === reOldStaff &&
    (!reFrom || l.date >= reFrom) && (!reTo || l.date <= reTo)
  );

  async function performReassign() {
    if (!reOldStaff || !reNewStaff) {
      setReMsg("Pick both the current name and the new name first.");
      return;
    }
    const total = matchingReceivedBy.length + matchingUsedBy.length;
    if (total === 0) {
      setReMsg("No matching records found for that name and date range.");
      return;
    }
    if (!confirm(`Reassign ${matchingReceivedBy.length} received-by record(s) and ${matchingUsedBy.length} used-by record(s) from "${reOldStaff}" to "${reNewStaff}"?`)) return;
    if (matchingReceivedBy.length) await supabase.from("reagents").update({ added_by: reNewStaff }).in("id", matchingReceivedBy.map((r) => r.id));
    if (matchingUsedBy.length) await supabase.from("consumption_logs").update({ used_by: reNewStaff }).in("id", matchingUsedBy.map((l) => l.id));
    await logActivity?.("settings_change", "config", `Reassigned ${total} record(s) from ${reOldStaff} to ${reNewStaff}${reFrom || reTo ? ` (${reFrom || "…"} to ${reTo || "…"})` : ""}`);
    setReMsg(`Reassigned ${total} record(s).`);
    reload();
  }

  const allItemNames = [...new Set((reagents || []).map((r) => r.name))].filter(Boolean).sort();

  const matchingItemLots = (reagents || []).filter((r) =>
    tnOldItem && r.name === tnOldItem &&
    (!tnFrom || r.date_added >= tnFrom) && (!tnTo || r.date_added <= tnTo)
  );

  async function performItemRename() {
    if (!tnOldItem || !tnNewItem.trim()) {
      setTnMsg("Pick the current test name and type the correct one first.");
      return;
    }
    if (matchingItemLots.length === 0) {
      setTnMsg("No matching lots found for that test name and date range.");
      return;
    }
    if (!confirm(`Rename ${matchingItemLots.length} lot(s) from "${tnOldItem}" to "${tnNewItem.trim()}"?`)) return;
    await supabase.from("reagents").update({ name: tnNewItem.trim() }).in("id", matchingItemLots.map((r) => r.id));
    await logActivity?.("settings_change", "config", `Renamed test "${tnOldItem}" → "${tnNewItem.trim()}" on ${matchingItemLots.length} lot(s)${tnFrom || tnTo ? ` (${tnFrom || "…"} to ${tnTo || "…"})` : ""}`);
    setTnMsg(`Renamed ${matchingItemLots.length} lot(s).`);
    reload();
  }

  async function addDevice() {
    if (!newDevice.name) return;
    await supabase.from("devices").insert(newDevice);
    await logActivity?.("device_add", "device", `${newDevice.name} (${newDevice.department})`);
    setNewDevice({ name: "", department: departments[0] || "" });
    reload();
  }

  async function deleteDevice(id, name) {
    await supabase.from("devices").delete().eq("id", id);
    await logActivity?.("device_delete", "device", name);
    reload();
  }

  async function addStaffAccount() {
    if (!newStaff.username || !newStaff.password) return;
    const { error } = await supabase.from("staff_accounts").insert(newStaff);
    setStaffMsg(error ? "That username may already exist." : "Account created.");
    if (!error) await logActivity?.("staff_add", "staff", newStaff.username);
    setNewStaff({ username: "", password: "" });
    reload();
    setTimeout(() => setStaffMsg(""), 2500);
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

  async function addPreset() {
    if (!newPreset.name) return;
    await supabase.from("reagent_presets").insert(newPreset);
    await logActivity?.("preset_add", "preset", newPreset.name);
    setNewPreset({ name: "", department: departments[0] || "", unit: "mL" });
    reload();
  }

  async function deletePreset(id, name) {
    await supabase.from("reagent_presets").delete().eq("id", id);
    await logActivity?.("preset_delete", "preset", name);
    reload();
  }

  async function addDepartment() {
    const name = newDept.trim();
    if (!name || departments.includes(name)) return;
    await supabase.from("app_config").update({ departments: [...departments, name] }).eq("id", 1);
    await logActivity?.("department_add", "department", name);
    setNewDept("");
    reload();
  }

  async function removeDepartment(name) {
    if (!confirm(`Remove "${name}"? Existing reagents already using it are not affected.`)) return;
    await supabase.from("app_config").update({ departments: departments.filter((d) => d !== name) }).eq("id", 1);
    await logActivity?.("department_remove", "department", name);
    reload();
  }

  async function saveCreds() {
    const { error } = await supabase.from("app_config").update(creds).eq("id", 1);
    setMsg(error ? "Could not save." : "Saved.");
    if (!error) await logActivity?.("settings_change", "config", "Login credentials or defaults updated");
    reload();
    setTimeout(() => setMsg(""), 2500);
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Settings</h2>
      <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 24 }}>Only visible to your admin account.</div>

      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 0.3 }}>DEPARTMENTS</div>
      <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="e.g. Molecular Biology"
            value={newDept}
            onChange={(e) => setNewDept(e.target.value)}
            style={{ ...inputStyle, flex: 1, marginTop: 0 }}
          />
          <button onClick={addDepartment} style={{ background: "#0F7173", color: "#fff", border: "none", borderRadius: 7, padding: "0 14px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 30 }}>
        {departments.map((d) => (
          <div key={d} style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #E1E8E5", borderRadius: 20, padding: "6px 8px 6px 14px" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{d}</span>
            <button onClick={() => removeDepartment(d)} style={{ background: "none", border: "none", color: "#C1432B" }}><Trash2 size={13} /></button>
          </div>
        ))}
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 0.3 }}>REAGENT PRESET LIST</div>
      <div style={{ fontSize: 12.5, color: "#7B8E8A", marginBottom: 12 }}>
        This is the list staff pick from at the "Details" step when receiving stock.
      </div>

      <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Reagent name"
            value={newPreset.name}
            onChange={(e) => setNewPreset((p) => ({ ...p, name: e.target.value }))}
            style={{ ...inputStyle, flex: 2, minWidth: 140, marginTop: 0 }}
          />
          <select
            value={newPreset.department}
            onChange={(e) => setNewPreset((p) => ({ ...p, department: e.target.value }))}
            style={{ ...inputStyle, flex: 1, minWidth: 120, marginTop: 0 }}
          >
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <input
            placeholder="Unit"
            value={newPreset.unit}
            onChange={(e) => setNewPreset((p) => ({ ...p, unit: e.target.value }))}
            style={{ ...inputStyle, width: 80, marginTop: 0 }}
          />
          <button onClick={addPreset} style={{ background: "#0F7173", color: "#fff", border: "none", borderRadius: 7, padding: "0 14px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 30 }}>
        {presets.length === 0 && <div style={{ fontSize: 13, color: "#8A9694" }}>No presets yet — add your first reagent name above.</div>}
        {presets.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #E1E8E5", borderRadius: 8, padding: "9px 14px" }}>
            <div style={{ flex: 1, fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
            <div style={{ fontSize: 12.5, color: "#7B8E8A" }}>{p.department} · {p.unit}</div>
            <button onClick={() => deletePreset(p.id, p.name)} style={{ background: "none", border: "none", color: "#C1432B" }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 0.3 }}>DEVICES / ANALYZERS</div>
      <div style={{ fontSize: 12.5, color: "#7B8E8A", marginBottom: 12 }}>
        Each device belongs to a department. Staff only see devices matching the department they picked when receiving stock.
      </div>
      <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Device name, e.g. Cobas c311"
            value={newDevice.name}
            onChange={(e) => setNewDevice((d) => ({ ...d, name: e.target.value }))}
            style={{ ...inputStyle, flex: 2, minWidth: 160, marginTop: 0 }}
          />
          <select
            value={newDevice.department}
            onChange={(e) => setNewDevice((d) => ({ ...d, department: e.target.value }))}
            style={{ ...inputStyle, flex: 1, minWidth: 120, marginTop: 0 }}
          >
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <button onClick={addDevice} style={{ background: "#0F7173", color: "#fff", border: "none", borderRadius: 7, padding: "0 14px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 30 }}>
        {(devices || []).length === 0 && <div style={{ fontSize: 13, color: "#8A9694" }}>No devices yet — add your lab's analyzers above.</div>}
        {(devices || []).map((d) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #E1E8E5", borderRadius: 8, padding: "9px 14px" }}>
            <div style={{ flex: 1, fontWeight: 600, fontSize: 13.5 }}>{d.name}</div>
            <div style={{ fontSize: 12.5, color: "#7B8E8A" }}>{d.department}</div>
            <button onClick={() => deleteDevice(d.id, d.name)} style={{ background: "none", border: "none", color: "#C1432B" }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      {["super","owner"].includes(role) && (
        <>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 0.3 }}>EMPLOYEE ACCOUNTS</div>
          <div style={{ fontSize: 12.5, color: "#7B8E8A", marginBottom: 12 }}>
            Create a personal login for each employee. {role === "owner" ? "As Owner, you can also grant any employee a higher role below." : "They get regular staff permissions (no delete, no settings)."}
          </div>
          <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                placeholder="Username"
                value={newStaff.username}
                onChange={(e) => setNewStaff((s) => ({ ...s, username: e.target.value }))}
                style={{ ...inputStyle, flex: 1, minWidth: 140, marginTop: 0 }}
              />
              <input
                placeholder="Password"
                type={showPasswords ? "text" : "password"}
                value={newStaff.password}
                onChange={(e) => setNewStaff((s) => ({ ...s, password: e.target.value }))}
                style={{ ...inputStyle, flex: 1, minWidth: 140, marginTop: 0 }}
              />
              <button onClick={addStaffAccount} style={{ background: "#0F7173", color: "#fff", border: "none", borderRadius: 7, padding: "0 14px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                <Plus size={14} /> Add
              </button>
            </div>
            {staffMsg && <div style={{ fontSize: 12, color: "#516361", marginTop: 8 }}>{staffMsg}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 30 }}>
            {(staffAccounts || []).length === 0 && <div style={{ fontSize: 13, color: "#8A9694" }}>No individual employee accounts yet — everyone shares the "Staff username/password" below.</div>}
            {(staffAccounts || []).map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #E1E8E5", borderRadius: 8, padding: "9px 14px" }}>
                <div style={{ flex: 1, fontWeight: 600, fontSize: 13.5 }}>{s.username}</div>
                {role === "owner" ? (
                  <select value={s.role || "staff"} onChange={(e) => updateStaffRole(s.id, s.username, e.target.value)} style={{ ...inputStyle, width: 110, marginTop: 0 }}>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                    <option value="super">Super</option>
                  </select>
                ) : (
                  <span style={{ fontSize: 11.5, color: "#8A9694", textTransform: "capitalize" }}>{s.role || "staff"}</span>
                )}
                <button onClick={() => removeStaffAccount(s.id, s.username)} style={{ background: "none", border: "none", color: "#C1432B" }}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 0.3 }}>LOGIN & DEFAULTS</div>
      <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ ...labelStyle, flex: 1 }}>Shared staff username<input style={inputStyle} value={creds.lab_username} onChange={(e) => setCreds((c) => ({ ...c, lab_username: e.target.value }))} /></label>
          <label style={{ ...labelStyle, flex: 1 }}>Shared staff password<input type={showPasswords ? "text" : "password"} style={inputStyle} value={creds.lab_password} onChange={(e) => setCreds((c) => ({ ...c, lab_password: e.target.value }))} /></label>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ ...labelStyle, flex: 1 }}>Your (admin) username<input style={inputStyle} value={creds.admin_username} onChange={(e) => setCreds((c) => ({ ...c, admin_username: e.target.value }))} /></label>
          <label style={{ ...labelStyle, flex: 1 }}>Your (admin) password<input type={showPasswords ? "text" : "password"} style={inputStyle} value={creds.admin_password} onChange={(e) => setCreds((c) => ({ ...c, admin_password: e.target.value }))} /></label>
        </div>
        {["super","owner"].includes(role) && (
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ ...labelStyle, flex: 1 }}>Super-user username<input style={inputStyle} value={creds.super_username} onChange={(e) => setCreds((c) => ({ ...c, super_username: e.target.value }))} /></label>
            <label style={{ ...labelStyle, flex: 1 }}>Super-user password<input type={showPasswords ? "text" : "password"} style={inputStyle} value={creds.super_password} onChange={(e) => setCreds((c) => ({ ...c, super_password: e.target.value }))} /></label>
          </div>
        )}
        {role === "owner" && (
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ ...labelStyle, flex: 1 }}>Owner username<input style={inputStyle} value={creds.owner_username} onChange={(e) => setCreds((c) => ({ ...c, owner_username: e.target.value }))} /></label>
            <label style={{ ...labelStyle, flex: 1 }}>Owner password<input type={showPasswords ? "text" : "password"} style={inputStyle} value={creds.owner_password} onChange={(e) => setCreds((c) => ({ ...c, owner_password: e.target.value }))} /></label>
          </div>
        )}
        <button type="button" onClick={() => setShowPasswords((v) => !v)} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#0F7173", fontSize: 12, fontWeight: 600, padding: 0, display: "flex", alignItems: "center", gap: 5 }}>
          {showPasswords ? <EyeOff size={13} /> : <Eye size={13} />} {showPasswords ? "Hide passwords" : "Show passwords"}
        </button>
        <label style={labelStyle}>Default low-stock alert (% of quantity received)
          <input type="number" style={inputStyle} value={creds.low_stock_default_percent} onChange={(e) => setCreds((c) => ({ ...c, low_stock_default_percent: Number(e.target.value) }))} />
        </label>
        <label style={labelStyle}>"Expiring soon" warning window (days before expiry)
          <input type="number" style={inputStyle} value={creds.expiry_warning_days} onChange={(e) => setCreds((c) => ({ ...c, expiry_warning_days: Number(e.target.value) }))} />
        </label>
        <button onClick={saveCreds} style={{ background: "#0F7173", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Save size={14} /> Save settings
        </button>
        {msg && <div style={{ fontSize: 12.5, color: "#2F6B4F" }}>{msg}</div>}
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 0.3, marginTop: 30 }}>THEME COLORS</div>
      <div style={{ fontSize: 12.5, color: "#7B8E8A", marginBottom: 12 }}>Pick a ready-made combination, or fine-tune your own below.</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {THEME_PRESETS.map((p) => (
          <button key={p.name} onClick={() => setTheme(p.colors)} style={{ background: "#fff", border: "2px solid " + (JSON.stringify(theme) === JSON.stringify(p.colors) ? p.colors.accent1 : "#E1E8E5"), borderRadius: 10, padding: 10, cursor: "pointer", width: 130 }}>
            <div style={{ height: 30, borderRadius: 6, background: `linear-gradient(135deg, ${p.colors.headerStart} 0%, ${p.colors.headerEnd} 100%)`, marginBottom: 6, display: "flex", alignItems: "center", gap: 4, padding: "0 6px" }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: p.colors.accent1 }} />
              <span style={{ width: 12, height: 12, borderRadius: 3, background: p.colors.accent2 }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, textAlign: "left" }}>{p.name}</div>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: "#7B8E8A", marginBottom: 12, fontWeight: 600 }}>Or fine-tune manually:</div>
      <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <ColorField label="Primary buttons" value={theme.accent1} onChange={(v) => setTheme((t) => ({ ...t, accent1: v }))} />
          <ColorField label="Secondary buttons" value={theme.accent2} onChange={(v) => setTheme((t) => ({ ...t, accent2: v }))} />
          <ColorField label="Header — top" value={theme.headerStart} onChange={(v) => setTheme((t) => ({ ...t, headerStart: v }))} />
          <ColorField label="Header — bottom" value={theme.headerEnd} onChange={(v) => setTheme((t) => ({ ...t, headerEnd: v }))} />
        </div>
        <div style={{ height: 44, borderRadius: 8, background: `linear-gradient(135deg, ${theme.headerStart} 0%, ${theme.headerEnd} 100%)`, display: "flex", alignItems: "center", gap: 10, padding: "0 14px" }}>
          <span style={{ background: theme.accent1, color: "#fff", fontSize: 11.5, fontWeight: 700, padding: "5px 10px", borderRadius: 6 }}>Primary</span>
          <span style={{ background: theme.accent2, color: "#fff", fontSize: 11.5, fontWeight: 700, padding: "5px 10px", borderRadius: 6 }}>Secondary</span>
          <span style={{ color: "#fff", fontSize: 12, fontFamily: "monospace" }}>preview</span>
        </div>
        <button onClick={saveTheme} style={{ background: theme.accent1, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Save size={14} /> Save theme colors
        </button>
        {themeMsg && <div style={{ fontSize: 12.5, color: "#2F6B4F" }}>{themeMsg}</div>}
      </div>

      <div style={{ fontSize: 11.5, color: "#8A9694", marginTop: 14 }}>
        Note: these credentials are stored as plain text in the database, and the database's anon key is visible in the browser — fine for internal use, not for sensitive data. Individual employee accounts (above) help with accountability, but full access control would need Supabase Auth, which is a bigger change than adjusting these settings.
      </div>

      {["super","owner"].includes(role) && (
        <>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 0.3, marginTop: 30 }}>DATA TOOLS</div>
          <div style={{ fontSize: 12.5, color: "#7B8E8A", marginBottom: 12 }}>Bulk-delete reagent lots and usage logs — useful for clearing out test data. Filter by device, test/item name, and/or date range, review the count, then confirm.</div>
          <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: 16 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <label style={{ ...labelStyle, flex: 1, minWidth: 160 }}>Device (optional)
                <select style={inputStyle} value={delDevice} onChange={(e) => setDelDevice(e.target.value)}>
                  <option value="">All devices</option>
                  {allDeviceNames.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label style={{ ...labelStyle, flex: 1, minWidth: 160 }}>Test / item name (optional)
                <input style={inputStyle} value={delItem} onChange={(e) => setDelItem(e.target.value)} placeholder="e.g. HCV" />
              </label>
              <label style={{ ...labelStyle, flex: 1, minWidth: 130 }}>From date
                <input type="date" style={inputStyle} value={delFrom} onChange={(e) => setDelFrom(e.target.value)} />
              </label>
              <label style={{ ...labelStyle, flex: 1, minWidth: 130 }}>To date
                <input type="date" style={inputStyle} value={delTo} onChange={(e) => setDelTo(e.target.value)} />
              </label>
            </div>
            <div style={{ fontSize: 12.5, color: "#516361", marginBottom: 10 }}>
              Matches: <b>{matchingLots.length}</b> reagent lot(s), <b>{matchingLogs.length}</b> usage log(s)
            </div>
            <button onClick={performDelete} style={{ background: "#C1432B", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}>
              <Trash2 size={14} /> Delete matching data
            </button>
            {delMsg && <div style={{ fontSize: 12.5, color: "#516361", marginTop: 8 }}>{delMsg}</div>}
          </div>

          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 0.3, marginTop: 24 }}>REASSIGN EMPLOYEE</div>
          <div style={{ fontSize: 12.5, color: "#7B8E8A", marginBottom: 12 }}>Fix a wrong name on past records without deleting anything — e.g. something was logged under the wrong employee for a period. Renames both "received by" and "used by" entries that match.</div>
          <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: 16 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <label style={{ ...labelStyle, flex: 1, minWidth: 160 }}>Current name on record
                <select style={inputStyle} value={reOldStaff} onChange={(e) => setReOldStaff(e.target.value)}>
                  <option value="">Choose…</option>
                  {allStaffNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label style={{ ...labelStyle, flex: 1, minWidth: 160 }}>Change to
                <input style={inputStyle} value={reNewStaff} onChange={(e) => setReNewStaff(e.target.value)} placeholder="Correct name" />
              </label>
              <label style={{ ...labelStyle, flex: 1, minWidth: 130 }}>From date
                <input type="date" style={inputStyle} value={reFrom} onChange={(e) => setReFrom(e.target.value)} />
              </label>
              <label style={{ ...labelStyle, flex: 1, minWidth: 130 }}>To date
                <input type="date" style={inputStyle} value={reTo} onChange={(e) => setReTo(e.target.value)} />
              </label>
            </div>
            <div style={{ fontSize: 12.5, color: "#516361", marginBottom: 10 }}>
              Matches: <b>{matchingReceivedBy.length}</b> received-by record(s), <b>{matchingUsedBy.length}</b> used-by record(s)
            </div>
            <button onClick={performReassign} style={{ background: "var(--accent-2)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}>
              <Pencil size={14} /> Reassign matching records
            </button>
            {reMsg && <div style={{ fontSize: 12.5, color: "#516361", marginTop: 8 }}>{reMsg}</div>}
          </div>

          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 0.3, marginTop: 24 }}>RENAME TEST / ITEM</div>
          <div style={{ fontSize: 12.5, color: "#7B8E8A", marginBottom: 12 }}>Fix a wrong test name on past lots without deleting anything — pick the current name, the date range it was used under, and what it should actually be.</div>
          <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: 16 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <label style={{ ...labelStyle, flex: 1, minWidth: 160 }}>Current test name
                <select style={inputStyle} value={tnOldItem} onChange={(e) => setTnOldItem(e.target.value)}>
                  <option value="">Choose…</option>
                  {allItemNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label style={{ ...labelStyle, flex: 1, minWidth: 160 }}>Change to
                <input style={inputStyle} value={tnNewItem} onChange={(e) => setTnNewItem(e.target.value)} placeholder="Correct test name" />
              </label>
              <label style={{ ...labelStyle, flex: 1, minWidth: 130 }}>From date
                <input type="date" style={inputStyle} value={tnFrom} onChange={(e) => setTnFrom(e.target.value)} />
              </label>
              <label style={{ ...labelStyle, flex: 1, minWidth: 130 }}>To date
                <input type="date" style={inputStyle} value={tnTo} onChange={(e) => setTnTo(e.target.value)} />
              </label>
            </div>
            <div style={{ fontSize: 12.5, color: "#516361", marginBottom: 10 }}>
              Matches: <b>{matchingItemLots.length}</b> lot(s)
            </div>
            <button onClick={performItemRename} style={{ background: "var(--accent-2)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}>
              <Pencil size={14} /> Rename matching lots
            </button>
            {tnMsg && <div style={{ fontSize: 12.5, color: "#516361", marginTop: 8 }}>{tnMsg}</div>}
          </div>
        </>
      )}
    </div>
  );
}

const inputStyle = { width: "100%", border: "1px solid #C7D1CE", borderRadius: 7, padding: "9px 11px", fontSize: 14, marginTop: 4, boxSizing: "border-box" };
const labelStyle = { fontSize: 12.5, fontWeight: 600, color: "#516361" };

function ColorField({ label, value, onChange }) {
  return (
    <label style={{ ...labelStyle, display: "flex", flexDirection: "column", gap: 4 }}>
      {label}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 40, height: 34, border: "1px solid #C7D1CE", borderRadius: 6, padding: 0 }} />
        <input value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, width: 90, marginTop: 0, fontFamily: "monospace", fontSize: 12.5 }} />
      </div>
    </label>
  );
}
