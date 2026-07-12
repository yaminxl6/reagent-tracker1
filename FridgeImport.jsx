import React, { useState } from "react";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { parseFridgeFile } from "./fridgeFileParser";

const inputStyle = { border: "1px solid #C7D1CE", borderRadius: 6, padding: "6px 8px", fontSize: 13, boxSizing: "border-box" };

// Lets the user upload an Excel/Word fridge inventory sheet (matching the
// paper form) and previews the parsed month, fridge name, and rows before
// applying them via onApply({ month, refrigeratorName, rows }).
export default function FridgeImport({ onApply }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState(null);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    setError("");
    setParsed(null);
    try {
      const result = await parseFridgeFile(file);
      if (!result.rows.length) {
        setError("Couldn't find any item rows in this file. Make sure it has an Item/Unit/Quantity/Expiry date table.");
      } else if (!result.refrigeratorName) {
        setError("Found the item table, but couldn't find a \"Refrigerator: name\" line — add it manually below before applying.");
        setParsed(result);
      } else {
        setParsed(result);
      }
    } catch (err) {
      setError(err.message || "Couldn't read this file.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  function updateField(field, value) {
    setParsed((p) => ({ ...p, [field]: value }));
  }
  function updateRow(i, field, value) {
    setParsed((p) => ({ ...p, rows: p.rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)) }));
  }

  function confirmApply() {
    if (!parsed.refrigeratorName || !parsed.month) return;
    onApply(parsed);
    setParsed(null);
  }

  return (
    <div>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px dashed var(--accent-1)", color: "var(--accent-1)", borderRadius: 7, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
        <Upload size={14} /> {busy ? "Reading…" : "Upload fridge sheet (Excel or Word)"}
        <input type="file" accept=".xlsx,.xls,.csv,.docx" onChange={handleFile} disabled={busy} style={{ display: "none" }} />
      </label>
      {error && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#C1432B", marginTop: 8 }}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
        </div>
      )}

      {parsed && (
        <div style={{ background: "#FBF8F0", border: "1px solid #E8DCC0", borderRadius: 8, padding: 12, marginTop: 12 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#516361" }}>Month
              <input type="month" style={{ ...inputStyle, display: "block", marginTop: 4 }} value={parsed.month || ""} onChange={(e) => updateField("month", e.target.value)} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#516361", flex: 1, minWidth: 160 }}>Refrigerator name
              <input style={{ ...inputStyle, display: "block", marginTop: 4, width: "100%" }} value={parsed.refrigeratorName || ""} onChange={(e) => updateField("refrigeratorName", e.target.value)} />
            </label>
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8A6D2F", marginBottom: 8 }}>
            {parsed.rows.length} row(s) found — review before applying:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 320, overflowY: "auto" }}>
            {parsed.rows.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 5, alignItems: "center", background: "#fff", borderRadius: 6, padding: 5 }}>
                <input value={r.device_group} onChange={(e) => updateRow(i, "device_group", e.target.value)} style={{ ...inputStyle, width: 90 }} placeholder="Section" />
                <input value={r.item_name} onChange={(e) => updateRow(i, "item_name", e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Item" />
                <input value={r.lot_number} onChange={(e) => updateRow(i, "lot_number", e.target.value)} style={{ ...inputStyle, width: 90 }} placeholder="Lot" />
                <input value={r.quantity} onChange={(e) => updateRow(i, "quantity", e.target.value)} style={{ ...inputStyle, width: 55 }} placeholder="Qty" />
                <input type="date" value={r.expiry_date || ""} onChange={(e) => updateRow(i, "expiry_date", e.target.value)} style={{ ...inputStyle, width: 130 }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={confirmApply} disabled={!parsed.refrigeratorName || !parsed.month} style={{ background: parsed.refrigeratorName && parsed.month ? "var(--accent-1)" : "#C7D1CE", color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
              <CheckCircle2 size={13} /> Add {parsed.rows.length} row(s)
            </button>
            <button onClick={() => setParsed(null)} style={{ background: "none", border: "1px solid #C7D1CE", borderRadius: 6, padding: "7px 14px", fontSize: 12 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
