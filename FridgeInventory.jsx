import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Download, Refrigerator, Printer } from "lucide-react";
import { supabase } from "./supabaseClient";

const inputStyle = { border: "1px solid #C7D1CE", borderRadius: 6, padding: "6px 8px", fontSize: 13, boxSizing: "border-box" };
const labelStyle = { fontSize: 12.5, fontWeight: 600, color: "#516361" };
const todayMonth = () => new Date().toISOString().slice(0, 7);

function displayMonth(monthISO) {
  const [y, m] = monthISO.split("-");
  return `${m}-${y}`;
}

export default function FridgeInventory({ username, logActivity }) {
  const [all, setAll] = useState(null);
  const [month, setMonth] = useState(todayMonth());
  const [refrigeratorName, setRefrigeratorName] = useState("");
  const [countedBy, setCountedBy] = useState("");

  async function loadAll() {
    const { data } = await supabase.from("fridge_inventory").select("*").order("row_order");
    setAll(data || []);
  }
  useEffect(() => { loadAll(); }, []);

  const fridgeNames = useMemo(() => [...new Set((all || []).map((r) => r.refrigerator_name))], [all]);
  const itemSuggestions = useMemo(() => [...new Set((all || []).map((r) => r.item_name))], [all]);
  const deviceSuggestions = useMemo(() => [...new Set((all || []).map((r) => r.device_group).filter(Boolean))], [all]);

  const currentRows = (all || []).filter((r) => r.month === month && r.refrigerator_name === refrigeratorName);
  const groups = useMemo(() => {
    const map = {};
    currentRows.forEach((r) => {
      const key = r.device_group || "General";
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [currentRows]);

  async function addRow(deviceGroup) {
    const maxOrder = currentRows.reduce((m, r) => Math.max(m, r.row_order || 0), 0);
    const { data } = await supabase.from("fridge_inventory").insert({
      month, refrigerator_name: refrigeratorName, counted_by: countedBy,
      device_group: deviceGroup, item_name: "", lot_number: "", quantity: "", row_order: maxOrder + 1,
    }).select().single();
    await logActivity?.("fridge_count", "fridge", `${refrigeratorName} — added row in ${deviceGroup || "General"}`);
    setAll((a) => [...a, data]);
  }

  async function addSection() {
    const name = prompt("New device/section name (e.g. VIDAS):");
    if (!name) return;
    addRow(name);
  }

  async function updateRow(id, field, value) {
    setAll((a) => a.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    await supabase.from("fridge_inventory").update({ [field]: value }).eq("id", id);
  }

  async function deleteRow(id) {
    await supabase.from("fridge_inventory").delete().eq("id", id);
    setAll((a) => a.filter((r) => r.id !== id));
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const rows = currentRows.map((r) => ({ Section: r.device_group, Item: r.item_name, Lot: r.lot_number, Quantity: r.quantity, "Expiry date": r.expiry_date || "" }));
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "No rows yet." }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, displayMonth(month));
    XLSX.writeFile(wb, `reagent-inventory-${refrigeratorName || "fridge"}-${month}.xlsx`);
  }

  if (all === null) return <div style={{ padding: 40, textAlign: "center", color: "#8A9694" }}>Loading…</div>;

  return (
    <div>
      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><Refrigerator size={20} /> Fridge Inventory</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} style={{ background: "none", border: "1px solid #C7D1CE", color: "#516361", borderRadius: 7, padding: "8px 12px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Printer size={14} /> Print</button>
          <button onClick={exportExcel} style={{ background: "var(--accent-2)", color: "#fff", border: "none", borderRadius: 7, padding: "8px 12px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Download size={14} /> Export Excel</button>
        </div>
      </div>
      <div className="no-print" style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 20 }}>Monthly stock count sheet — matches your paper form. Not shown in Reports.</div>

      <div className="no-print" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <label style={labelStyle}>Month
          <input type="month" style={inputStyle} value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <label style={{ ...labelStyle, flex: 1, minWidth: 160 }}>Refrigerator
          <input list="fridge-names" style={{ ...inputStyle, width: "100%" }} value={refrigeratorName} onChange={(e) => setRefrigeratorName(e.target.value)} placeholder="e.g. maged" />
          <datalist id="fridge-names">{fridgeNames.map((n) => <option key={n} value={n} />)}</datalist>
        </label>
        <label style={{ ...labelStyle, flex: 1, minWidth: 160 }}>Counted by
          <input style={{ ...inputStyle, width: "100%" }} value={countedBy} onChange={(e) => setCountedBy(e.target.value)} />
        </label>
      </div>

      {!refrigeratorName ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#8A9694", fontSize: 13.5 }}>Type or pick a refrigerator name above to start.</div>
      ) : (
        <div id="fridge-print-area">
          <div style={{ textAlign: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Reagent inventory</div>
            <div style={{ fontSize: 12.5, color: "#7B8E8A" }}>month: {displayMonth(month)}</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, margin: "14px 0 8px" }}>Refrigerator: {refrigeratorName}</div>

          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #C7D1CE" }}>
            <thead>
              <tr>
                <th style={thStyle}>Item</th>
                <th style={thStyle}>Unit</th>
                <th style={thStyle}>Quantity</th>
                <th style={thStyle}>Expiry date</th>
                <th className="no-print" style={{ ...thStyle, width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groups).map(([section, rows]) => (
                <React.Fragment key={section}>
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", fontWeight: 700, background: "#F7F9F8", border: "1px solid #C7D1CE", padding: "6px 0" }}>#{section}</td>
                  </tr>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td style={tdStyle}>
                        <input list="item-suggestions" style={cellInputStyle} value={r.item_name} onChange={(e) => updateRow(r.id, "item_name", e.target.value)} />
                      </td>
                      <td style={tdStyle}>
                        <input style={cellInputStyle} value={r.lot_number} onChange={(e) => updateRow(r.id, "lot_number", e.target.value)} />
                      </td>
                      <td style={tdStyle}>
                        <input style={{ ...cellInputStyle, textAlign: "center" }} value={r.quantity} onChange={(e) => updateRow(r.id, "quantity", e.target.value)} placeholder="e.g. 1½" />
                      </td>
                      <td style={tdStyle}>
                        <input type="date" style={cellInputStyle} value={r.expiry_date || ""} onChange={(e) => updateRow(r.id, "expiry_date", e.target.value)} />
                      </td>
                      <td className="no-print" style={{ ...tdStyle, textAlign: "center" }}>
                        <button onClick={() => deleteRow(r.id)} style={{ background: "none", border: "none", color: "#C1432B" }}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                  <tr className="no-print">
                    <td colSpan={5} style={{ border: "1px solid #C7D1CE", padding: 4 }}>
                      <button onClick={() => addRow(section)} style={{ background: "none", border: "none", color: "var(--accent-1)", fontSize: 12, fontWeight: 600 }}>+ Add row to #{section}</button>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>

          <datalist id="item-suggestions">{itemSuggestions.map((n) => <option key={n} value={n} />)}</datalist>

          <button onClick={addSection} className="no-print" style={{ marginTop: 14, background: "none", border: "1px dashed var(--accent-1)", color: "var(--accent-1)", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Add device section {deviceSuggestions.length > 0 ? `(existing: ${deviceSuggestions.join(", ")})` : ""}
          </button>
        </div>
      )}
    </div>
  );
}

const thStyle = { border: "1px solid #C7D1CE", padding: "8px 10px", fontSize: 12.5, fontWeight: 700, background: "#F0F3F2", textAlign: "left" };
const tdStyle = { border: "1px solid #C7D1CE", padding: "4px 6px" };
const cellInputStyle = { border: "none", background: "transparent", fontSize: 13, width: "100%", padding: "4px 2px" };
