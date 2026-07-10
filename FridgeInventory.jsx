import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Download, Refrigerator } from "lucide-react";
import { supabase } from "./supabaseClient";

const inputStyle = { width: "100%", border: "1px solid #C7D1CE", borderRadius: 7, padding: "9px 11px", fontSize: 14, marginTop: 4, boxSizing: "border-box" };
const labelStyle = { fontSize: 12.5, fontWeight: 600, color: "#516361" };
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function FridgeInventory({ username, logActivity }) {
  const [entries, setEntries] = useState(null);
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [form, setForm] = useState({ location_type: "Fridge", location_name: "", item_name: "", unit: "", quantity: "", counted_by: "", count_date: todayISO() });

  async function loadAll() {
    const { data } = await supabase.from("fridge_inventory").select("*").order("count_date", { ascending: false });
    setEntries(data || []);
  }
  useEffect(() => { loadAll(); }, []);

  const locationSuggestions = useMemo(() => [...new Set((entries || []).map((e) => e.location_name))], [entries]);
  const itemSuggestions = useMemo(() => [...new Set((entries || []).map((e) => e.item_name))], [entries]);

  async function addEntry() {
    if (!form.location_name || !form.item_name || !form.quantity || !form.counted_by) return;
    await supabase.from("fridge_inventory").insert({ ...form, quantity: Number(form.quantity) });
    await logActivity?.("fridge_count", "fridge", `${form.location_name} — ${form.item_name}: ${form.quantity} ${form.unit || "unit"} (counted by ${form.counted_by})`);
    setForm((f) => ({ ...f, item_name: "", unit: "", quantity: "" }));
    loadAll();
  }

  async function deleteEntry(e) {
    if (!confirm("Delete this count entry?")) return;
    await supabase.from("fridge_inventory").delete().eq("id", e.id);
    await logActivity?.("fridge_count_delete", "fridge", `${e.location_name} — ${e.item_name}`);
    loadAll();
  }

  const monthEntries = (entries || []).filter((e) => e.count_date.slice(0, 7) === month);
  const byLocation = useMemo(() => {
    const map = {};
    monthEntries.forEach((e) => {
      const key = `${e.location_type}::${e.location_name}`;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [monthEntries]);

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const rows = monthEntries.map((e) => ({
      Type: e.location_type, Location: e.location_name, Item: e.item_name,
      Quantity: e.quantity, Unit: e.unit, "Counted by": e.counted_by, Date: e.count_date,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "No counts recorded for this month." }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, month);
    XLSX.writeFile(wb, `fridge-inventory-${month}.xlsx`);
  }

  if (entries === null) return <div style={{ padding: 40, textAlign: "center", color: "#8A9694" }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><Refrigerator size={20} /> Fridge & Equipment Inventory</h2>
        <button onClick={exportExcel} style={{ background: "var(--accent-2)", color: "#fff", border: "none", borderRadius: 7, padding: "8px 12px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Download size={14} /> Export Excel</button>
      </div>
      <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 20 }}>Monthly stock counts of what's kept inside fridges and on equipment — separate from the reagent Reports.</div>

      <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, letterSpacing: 0.3 }}>LOG A COUNT</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ ...labelStyle, width: 110 }}>Type
            <select style={inputStyle} value={form.location_type} onChange={(e) => setForm((f) => ({ ...f, location_type: e.target.value }))}>
              <option value="Fridge">Fridge</option>
              <option value="Equipment">Equipment</option>
            </select>
          </label>
          <label style={{ ...labelStyle, flex: 1, minWidth: 160 }}>Fridge / Equipment name
            <input list="location-suggestions" style={inputStyle} value={form.location_name} onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))} placeholder="e.g. Fridge 1" />
            <datalist id="location-suggestions">{locationSuggestions.map((n) => <option key={n} value={n} />)}</datalist>
          </label>
          <label style={{ ...labelStyle, flex: 1, minWidth: 160 }}>Item
            <input list="item-suggestions" style={inputStyle} value={form.item_name} onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))} placeholder="e.g. Glucose reagent" />
            <datalist id="item-suggestions">{itemSuggestions.map((n) => <option key={n} value={n} />)}</datalist>
          </label>
          <label style={{ ...labelStyle, width: 90 }}>Quantity<input type="number" style={inputStyle} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} /></label>
          <label style={{ ...labelStyle, width: 80 }}>Unit<input style={inputStyle} value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="mL" /></label>
          <label style={{ ...labelStyle, width: 140 }}>Counted by<input style={inputStyle} value={form.counted_by} onChange={(e) => setForm((f) => ({ ...f, counted_by: e.target.value }))} /></label>
          <label style={{ ...labelStyle, width: 140 }}>Date<input type="date" style={inputStyle} value={form.count_date} onChange={(e) => setForm((f) => ({ ...f, count_date: e.target.value }))} /></label>
        </div>
        <button onClick={addEntry} style={{ marginTop: 12, background: "var(--accent-1)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} /> Add count</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 12.5, color: "#7B8E8A" }}>Month</span>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ border: "1px solid #C7D1CE", borderRadius: 6, padding: "7px 10px", fontSize: 13 }} />
      </div>

      {Object.keys(byLocation).length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#8A9694", fontSize: 13.5 }}>No counts logged for this month yet.</div>
      ) : (
        Object.entries(byLocation).map(([key, items]) => {
          const [type, name] = key.split("::");
          return (
            <div key={key} style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--accent-2)", background: "var(--accent-2-bg)", padding: "2px 7px", borderRadius: 4 }}>{type}</span>
                {name}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {items.map((e) => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #E1E8E5", borderRadius: 8, padding: "9px 14px", fontSize: 13 }}>
                    <div style={{ flex: 1, fontWeight: 600 }}>{e.item_name}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{e.quantity} {e.unit}</div>
                    <div style={{ color: "#8A9694", width: 90, fontFamily: "'IBM Plex Mono', monospace" }}>{e.count_date}</div>
                    <div style={{ color: "#7B8E8A" }}>{e.counted_by}</div>
                    <button onClick={() => deleteEntry(e)} style={{ background: "none", border: "none", color: "#C1432B" }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
