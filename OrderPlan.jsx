import React, { useState, useEffect, useMemo } from "react";
import { ClipboardList, Plus, Trash2, Save, CheckCircle2 } from "lucide-react";
import { supabase } from "./supabaseClient";

const inputStyle = { border: "1px solid #C7D1CE", borderRadius: 6, padding: "6px 8px", fontSize: 13, boxSizing: "border-box", width: "100%" };

const DEVICE_PALETTE = [
  { bg: "#EAF1FE", accent: "#2563EB" },
  { bg: "#FEF3E2", accent: "#D97706" },
  { bg: "#FDECEC", accent: "#DC2626" },
  { bg: "#E7F7F1", accent: "#059669" },
  { bg: "#F3E9E1", accent: "#B0755A" },
  { bg: "#F0E9FB", accent: "#7C3AED" },
  { bg: "#E7F0FB", accent: "#0EA5A5" },
  { bg: "#FBEAF3", accent: "#DB2777" },
];

function nextMonthISO() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 7);
}

function isTempId(id) {
  return String(id).startsWith("temp-");
}

export default function OrderPlan({ reagents, devices, logActivity }) {
  const [all, setAll] = useState(null);
  const [month, setMonth] = useState(nextMonthISO());
  const [dirty, setDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [deletedIds, setDeletedIds] = useState([]);

  async function loadAll() {
    const { data } = await supabase.from("device_order_plans").select("*").order("row_order");
    setAll(data || []);
    setDirty(false);
    setDeletedIds([]);
  }
  useEffect(() => { loadAll(); }, []);

  const deviceNames = useMemo(() => {
    const names = new Set([...(devices || []).map((d) => d.name), ...(reagents || []).map((r) => r.device).filter(Boolean)]);
    return [...names].sort();
  }, [devices, reagents]);

  const rowsByDevice = useMemo(() => {
    const map = {};
    (all || []).filter((r) => r.month === month).forEach((r) => {
      if (!map[r.device]) map[r.device] = [];
      map[r.device].push(r);
    });
    return map;
  }, [all, month]);

  function addRow(device) {
    const existing = rowsByDevice[device] || [];
    const maxOrder = existing.reduce((m, r) => Math.max(m, r.row_order || 0), 0);
    const tempRow = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      month, device, item_name: "", quantity: "", notes: "", row_order: maxOrder + 1,
    };
    setAll((a) => [...(a || []), tempRow]);
    setDirty(true);
  }

  function updateRow(id, field, value) {
    setAll((a) => a.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    setDirty(true);
  }

  function deleteRow(id) {
    setAll((a) => a.filter((r) => r.id !== id));
    if (!isTempId(id)) setDeletedIds((d) => [...d, id]);
    setDirty(true);
  }

  async function saveAll() {
    setSaveMsg("Saving…");
    if (deletedIds.length) await supabase.from("device_order_plans").delete().in("id", deletedIds);
    const currentRows = (all || []).filter((r) => r.month === month);
    const toInsert = currentRows.filter((r) => isTempId(r.id)).map(({ id, ...rest }) => rest);
    const toUpdate = currentRows.filter((r) => !isTempId(r.id));
    if (toInsert.length) await supabase.from("device_order_plans").insert(toInsert);
    for (const r of toUpdate) {
      await supabase.from("device_order_plans").update({ item_name: r.item_name, quantity: r.quantity, notes: r.notes }).eq("id", r.id);
    }
    await logActivity?.("settings_change", "config", `Order plan for ${month} updated (${toInsert.length} new, ${toUpdate.length} edited, ${deletedIds.length} removed)`);
    await loadAll();
    setSaveMsg("Saved ✓");
    setTimeout(() => setSaveMsg(""), 2500);
  }

  if (all === null) return <div style={{ padding: 40, textAlign: "center", color: "#8A9694" }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><ClipboardList size={20} /> Order Plan</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {saveMsg && <span style={{ fontSize: 12.5, color: "#059669", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={13} /> {saveMsg}</span>}
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ ...inputStyle, width: 150 }} />
          <button onClick={saveAll} disabled={!dirty} style={{ background: dirty ? "var(--accent-1)" : "#C7D1CE", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, cursor: dirty ? "pointer" : "default" }}>
            <Save size={14} /> Save
          </button>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 20 }}>Plan what to order for each device next month. Edits are local until you press Save.</div>

      {deviceNames.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#8A9694", fontSize: 13.5 }}>No devices found yet — add one in Settings or receive stock against a device first.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {deviceNames.map((device, i) => {
            const palette = DEVICE_PALETTE[i % DEVICE_PALETTE.length];
            const rows = rowsByDevice[device] || [];
            return (
              <div key={device} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.06)", overflow: "hidden" }}>
                <div style={{ background: palette.bg, padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: palette.accent }}>{device}</div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: palette.accent, background: "#fff", padding: "3px 9px", borderRadius: 20 }}>{rows.length} item(s)</span>
                </div>
                <div style={{ padding: "12px 18px" }}>
                  {rows.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                      <div style={{ display: "flex", gap: 8, fontSize: 11, fontWeight: 700, color: "#9CA3AF", padding: "0 4px" }}>
                        <div style={{ flex: 2 }}>Item</div>
                        <div style={{ flex: 1 }}>Quantity</div>
                        <div style={{ flex: 2 }}>Notes</div>
                        <div style={{ width: 24 }} />
                      </div>
                      {rows.map((r) => (
                        <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input style={{ ...inputStyle, flex: 2 }} value={r.item_name} onChange={(e) => updateRow(r.id, "item_name", e.target.value)} placeholder="Reagent / item name" />
                          <input style={{ ...inputStyle, flex: 1 }} value={r.quantity} onChange={(e) => updateRow(r.id, "quantity", e.target.value)} placeholder="Qty" />
                          <input style={{ ...inputStyle, flex: 2 }} value={r.notes} onChange={(e) => updateRow(r.id, "notes", e.target.value)} placeholder="Notes (optional)" />
                          <button onClick={() => deleteRow(r.id)} style={{ background: "none", border: "none", color: "#DC2626", width: 24, flexShrink: 0 }}><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => addRow(device)} style={{ background: "none", border: `1px dashed ${palette.accent}`, color: palette.accent, borderRadius: 7, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    <Plus size={13} /> Add item to order
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
