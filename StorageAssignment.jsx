import React, { useState, useMemo } from "react";
import { Package, CheckCircle2 } from "lucide-react";

// "Freezer (-20°C)" and "Deep Freezer (-80°C)" aren't part of the app's
// existing fridge inventory, so they're always offered in addition to
// whatever real fridge names (fridgeNames prop) the lab already has.
const EXTRA_LOCATIONS = ["Freezer (-20°C)", "Deep Freezer (-80°C)"];

const thStyle = { textAlign: "left", padding: "11px 14px", fontSize: 11.5, fontWeight: 650, color: "#667085", textTransform: "uppercase", letterSpacing: 0.3 };
const tdStyle = { padding: "12px 14px", color: "#344054", fontSize: 13.5 };

// Displays every reagent currently in "Pending Storage" status and lets an
// authorized user assign one or many of them to a storage location. Staff
// without admin/super/owner role can view the list but see no Assign
// controls at all (view-only, per the requested permission model).
export default function StorageAssignment({ reagents, role, fridgeNames, onAssign }) {
  const isAuthorized = ["admin", "super", "owner"].includes(role);
  const locations = useMemo(() => [...(fridgeNames || []), ...EXTRA_LOCATIONS], [fridgeNames]);
  const [selected, setSelected] = useState([]);
  const [batchLocation, setBatchLocation] = useState("");
  const [rowLocation, setRowLocation] = useState({}); // per-row picked location before single Assign click
  const [busy, setBusy] = useState(false);

  const pending = useMemo(
    () => (reagents || []).filter((r) => !r.deleted && r.storage_status === "Pending Storage"),
    [reagents]
  );

  function toggle(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function toggleAll() {
    setSelected((s) => (s.length === pending.length ? [] : pending.map((r) => r.id)));
  }

  async function assignOne(id) {
    const loc = rowLocation[id] || locations[0];
    setBusy(true);
    await onAssign([id], loc);
    setBusy(false);
    setSelected((s) => s.filter((x) => x !== id));
  }

  async function assignSelected() {
    if (selected.length === 0) return;
    const loc = batchLocation || locations[0];
    setBusy(true);
    await onAssign(selected, loc);
    setBusy(false);
    setSelected([]);
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 650, color: "#101828", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Package size={19} /> Storage Assignment
          </h2>
          <div style={{ fontSize: 13, color: "#667085", marginTop: 3 }}>
            Reagents received but not yet placed in a storage location.
            {!isAuthorized && " View only — ask an admin to assign storage."}
          </div>
        </div>
        {isAuthorized && selected.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#F7F8FA", borderRadius: 10, padding: "8px 10px" }}>
            <span style={{ fontSize: 13, color: "#344054", fontWeight: 600 }}>{selected.length} selected</span>
            <span style={{ fontSize: 13, color: "#667085" }}>Assign to</span>
            <select value={batchLocation || locations[0] || ""} onChange={(e) => setBatchLocation(e.target.value)} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "7px 10px", fontSize: 13 }}>
              {locations.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <button
              disabled={busy}
              onClick={assignSelected}
              style={{ background: "#0F7173", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}
            >
              <CheckCircle2 size={14} /> Assign Selected
            </button>
          </div>
        )}
      </div>

      <div style={{ background: "#fff", border: "1px solid #EEF1F4", borderRadius: 16, overflow: "hidden", marginTop: 18 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FAFBFC" }}>
                {isAuthorized && (
                  <th style={thStyle}>
                    <input type="checkbox" checked={pending.length > 0 && selected.length === pending.length} onChange={toggleAll} />
                  </th>
                )}
                {["Reagent Name", "Analyzer", "Lot Number", "Expiry Date", "Quantity", "Storage Condition", "Received Date", "Received By", ""].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 && (
                <tr><td colSpan={isAuthorized ? 10 : 9} style={{ textAlign: "center", padding: 36, color: "#98A2B3", fontSize: 13.5 }}>Nothing pending storage right now.</td></tr>
              )}
              {pending.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #F0F2F5" }}>
                  {isAuthorized && (
                    <td style={tdStyle}><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} /></td>
                  )}
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#101828" }}>{r.name}</td>
                  <td style={tdStyle}>{r.device || "—"}</td>
                  <td style={tdStyle}>{r.lot_number}</td>
                  <td style={tdStyle}>{r.expiry_date}</td>
                  <td style={tdStyle}>{r.current_quantity} {r.unit}</td>
                  <td style={tdStyle}>{r.storage_condition_ok ? "OK on arrival" : "Flagged on arrival"}</td>
                  <td style={tdStyle}>{r.date_added}</td>
                  <td style={tdStyle}>{r.added_by}</td>
                  <td style={tdStyle}>
                    {isAuthorized ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <select
                          value={rowLocation[r.id] || locations[0]}
                          onChange={(e) => setRowLocation((m) => ({ ...m, [r.id]: e.target.value }))}
                          style={{ border: "1px solid #E5E7EB", borderRadius: 7, padding: "5px 7px", fontSize: 12.5 }}
                        >
                          {locations.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <button
                          disabled={busy}
                          onClick={() => assignOne(r.id)}
                          style={{ background: "#0F7173", color: "#fff", border: "none", borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 700 }}
                        >
                          Assign
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: "#98A2B3" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
