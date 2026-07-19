import React, { useState } from "react";
import { Upload, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { parseReagentFile } from "./reagentFileParser";

const inputStyle = { border: "1px solid #C7D1CE", borderRadius: 6, padding: "5px 7px", fontSize: 12, boxSizing: "border-box" };

// Lets the user upload an Excel/Word file listing multiple reagent lots to
// receive at once. Recognizes columns automatically, previews/lets the
// user edit each row, then hands back onApply(rows).
export default function ReagentImport({ departments, onApply }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState(null);
  const [applyMsg, setApplyMsg] = useState("");

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    setError("");
    setRows(null);
    setApplyMsg("");
    try {
      const { rows: parsed } = await parseReagentFile(file);
      if (!parsed.length) {
        setError("Couldn't recognize any reagent rows in this file. Make sure it has at least a name column with lot/quantity/expiry.");
      } else {
        setRows(parsed.map((r) => ({
          ...r,
          department: departments.includes(r.department) ? r.department : departments[0] || "",
          itemType: ["Reagent", "QC", "Cal"].includes(r.itemType) ? r.itemType : "Reagent",
          receivedBy: r.receivedBy || "",
          receivedDate: r.receivedDate || new Date().toISOString().slice(0, 10),
        })));
      }
    } catch (err) {
      setError(err.message || "Couldn't read this file.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  function updateRow(i, key, value) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  function removeRow(i) {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  }

  function confirmApply() {
    const valid = rows.filter((r) => r.name && r.lotNumber && r.quantityReceived && r.expiryDate && r.receivedBy);
    const skipped = rows.length - valid.length;
    onApply(valid);
    setApplyMsg(`Received ${valid.length} lot(s)${skipped ? `, skipped ${skipped} incomplete row(s)` : ""}.`);
    setRows(null);
  }

  return (
    <div>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px dashed #0F7173", color: "#0F7173", borderRadius: 7, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
        <Upload size={14} /> {busy ? "Reading…" : "Bulk import from Excel or Word"}
        <input type="file" accept=".xlsx,.xls,.csv,.docx" onChange={handleFile} disabled={busy} style={{ display: "none" }} />
      </label>
      {error && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#C1432B", marginTop: 8 }}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
        </div>
      )}
      {applyMsg && !rows && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#2F6B4F", marginTop: 8 }}>
          <CheckCircle2 size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {applyMsg}
        </div>
      )}

      {rows && rows.length > 0 && (
        <div style={{ background: "#FBF8F0", border: "1px solid #E8DCC0", borderRadius: 8, padding: 12, marginTop: 12 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8A6D2F", marginBottom: 8 }}>
            Review before receiving ({rows.length} row(s)). Rows missing name/lot/quantity/expiry/received-by are skipped automatically. Inspection checks default to "pass" — edit individual lots afterward if any failed.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 380, overflowY: "auto" }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 5, alignItems: "center", background: "#fff", borderRadius: 6, padding: 6, flexWrap: "wrap" }}>
                <input value={r.name} onChange={(e) => updateRow(i, "name", e.target.value)} style={{ ...inputStyle, width: 120 }} placeholder="Name" />
                <select value={r.department} onChange={(e) => updateRow(i, "department", e.target.value)} style={{ ...inputStyle, width: 100 }}>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={r.itemType} onChange={(e) => updateRow(i, "itemType", e.target.value)} style={{ ...inputStyle, width: 75 }}>
                  <option value="Reagent">Reagent</option>
                  <option value="QC">QC</option>
                  <option value="Cal">Cal</option>
                </select>
                <input value={r.lotNumber} onChange={(e) => updateRow(i, "lotNumber", e.target.value)} style={{ ...inputStyle, width: 80 }} placeholder="Lot" />
                <input value={r.unit} onChange={(e) => updateRow(i, "unit", e.target.value)} style={{ ...inputStyle, width: 55 }} placeholder="Unit" />
                <input type="number" value={r.quantityReceived} onChange={(e) => updateRow(i, "quantityReceived", e.target.value)} style={{ ...inputStyle, width: 65 }} placeholder="Qty" />
                <input type="date" lang="en-US" dir="ltr" value={r.expiryDate} onChange={(e) => updateRow(i, "expiryDate", e.target.value)} style={{ ...inputStyle, width: 115 }} />
                <input value={r.receivedBy} onChange={(e) => updateRow(i, "receivedBy", e.target.value)} style={{ ...inputStyle, width: 90 }} placeholder="Received by" />
                <button onClick={() => removeRow(i)} style={{ background: "none", border: "none", color: "#C1432B" }}><X size={14} /></button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={confirmApply} style={{ background: "#0F7173", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
              <CheckCircle2 size={13} /> Receive all
            </button>
            <button onClick={() => setRows(null)} style={{ background: "none", border: "1px solid #C7D1CE", borderRadius: 6, padding: "8px 16px", fontSize: 12.5 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
