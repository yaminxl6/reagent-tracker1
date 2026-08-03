import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Download, Droplet, Printer } from "lucide-react";
import { supabase } from "./supabaseClient";

const CATEGORIES = [
  { key: "damaged", label: "Damaged" },
  { key: "expired", label: "Expired" },
  { key: "returned", label: "Returned to central bank" },
];

export default function BloodBankDisposal({ username, initialListType }) {
  const [all, setAll] = useState(null);
  const [bagSuggestions, setBagSuggestions] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [deletedIds, setDeletedIds] = useState([]);

  async function loadAll() {
    const { data } = await supabase.from("blood_bank_disposal").select("*").order("created_at", { ascending: false });
    setAll(data || []);
    setDirty(false);
    setDeletedIds([]);
  }
  useEffect(() => { loadAll(); }, []);

  // Real bag numbers already on record in the FFP/PRBCs fridges — offered
  // as suggestions when typing a Bag Number here, so staff pick the exact
  // same number instead of retyping it slightly differently.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("fridge_inventory").select("lot_number").in("refrigerator_name", ["FFP", "PRBCs"]);
      setBagSuggestions([...new Set((data || []).map((r) => r.lot_number).filter(Boolean))]);
    })();
  }, []);

  // If a filter was requested from the sidebar shortcut, just pre-select
  // that category's rows into view once — after that it's a normal shared
  // table and every category is visible together.
  const [filterCategory, setFilterCategory] = useState(initialListType || "");
  useEffect(() => { if (initialListType) setFilterCategory(initialListType); }, [initialListType]);

  const rows = useMemo(() => (all || []).filter((r) => (filterCategory ? r.list_type === filterCategory : true)), [all, filterCategory]);

  function isTempId(id) { return String(id).startsWith("temp-"); }

  function addRow() {
    const tempRow = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      list_type: filterCategory || "damaged", bag_number: "", blood_type: "", date_added: new Date().toISOString().slice(0, 10),
      expiry_date: null, disposed_date: null, disposed_by: username || "", note: "",
    };
    setAll((a) => [tempRow, ...a]);
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
    if (deletedIds.length) await supabase.from("blood_bank_disposal").delete().in("id", deletedIds);
    const toInsert = rows.filter((r) => isTempId(r.id)).map(({ id, ...rest }) => rest);
    const toUpdate = rows.filter((r) => !isTempId(r.id));
    if (toInsert.length) await supabase.from("blood_bank_disposal").insert(toInsert);
    const results = await Promise.allSettled(
      toUpdate.map((r) =>
        supabase.from("blood_bank_disposal").update({
          list_type: r.list_type, bag_number: r.bag_number, blood_type: r.blood_type, date_added: r.date_added || null,
          expiry_date: r.expiry_date || null, disposed_date: r.disposed_date || null,
          disposed_by: r.disposed_by || "", note: r.note || "",
        }).eq("id", r.id)
      )
    );
    const failed = results.filter((res) => res.status === "rejected" || res.value?.error);
    if (failed.length) alert(`${failed.length} row(s) failed to save — please try again.`);
    await loadAll();
    setSaveMsg("Saved ✓");
    setTimeout(() => setSaveMsg(""), 2500);
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const HEADERS = ["Category", "Bag Number", "Blood Type", "Date Added", "Expiry Date", "Action Date", "Action By", "Note"];
    const aoa = [HEADERS, ...rows.map((r) => [
      CATEGORIES.find((c) => c.key === r.list_type)?.label || r.list_type,
      r.bag_number, r.blood_type, r.date_added, r.expiry_date, r.disposed_date, r.disposed_by, r.note,
    ])];
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, sheet, "Blood Bank Bags");
    XLSX.writeFile(wb, "blood-bank-report.xlsx");
  }

  const inputStyle = { width: "100%", border: "1px solid #E1E8E5", borderRadius: 6, padding: "6px 8px", fontSize: 13 };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        <Droplet size={20} color="#C1432B" /> Blood Bank — bag tracking
      </h2>
      <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 16 }}>
        Separate from the reagent report. One table for every bag — set its category (Damaged / Expired / Returned) per row.
      </div>

      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ border: "1px solid #C7D1CE", borderRadius: 7, padding: "8px 10px", fontSize: 13 }}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <button onClick={addRow} style={{ background: "#0F7173", color: "#fff", border: "none", borderRadius: 7, padding: "8px 12px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} /> Add bag</button>
        <button onClick={saveAll} disabled={!dirty} style={{ background: dirty ? "#0F7173" : "#C7D1CE", color: "#fff", border: "none", borderRadius: 7, padding: "8px 12px", fontSize: 13, fontWeight: 700 }}>Save</button>
        {saveMsg && <span style={{ fontSize: 12.5, color: "#2F6B4F", fontWeight: 600, alignSelf: "center" }}>{saveMsg}</span>}
        <button onClick={() => window.print()} style={{ background: "none", border: "1px solid #C7D1CE", color: "#516361", borderRadius: 7, padding: "8px 12px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Printer size={14} /> Print</button>
        <button onClick={exportExcel} style={{ background: "#378ADD", color: "#fff", border: "none", borderRadius: 7, padding: "8px 12px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Download size={14} /> Export Excel</button>
      </div>

      <datalist id="bag-suggestions">
        {bagSuggestions.map((b) => <option key={b} value={b} />)}
      </datalist>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F7F9F8" }}>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Bag Number</th>
              <th style={thStyle}>Blood Type</th>
              <th style={thStyle}>Date Added</th>
              <th style={thStyle}>Expiry Date</th>
              <th style={thStyle}>Action Date</th>
              <th style={thStyle}>Action By</th>
              <th style={thStyle}>Note</th>
              <th className="no-print" style={{ ...thStyle, width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: 20, color: "#8A9694" }}>No bags recorded yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={tdStyle}>
                  <select style={inputStyle} value={r.list_type} onChange={(e) => updateRow(r.id, "list_type", e.target.value)}>
                    {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </td>
                <td style={tdStyle}><input list="bag-suggestions" style={inputStyle} value={r.bag_number} onChange={(e) => updateRow(r.id, "bag_number", e.target.value)} /></td>
                <td style={tdStyle}><input style={inputStyle} value={r.blood_type} onChange={(e) => updateRow(r.id, "blood_type", e.target.value)} placeholder="e.g. O+" /></td>
                <td style={tdStyle}><input type="date" lang="en-US" dir="ltr" style={inputStyle} value={r.date_added || ""} onChange={(e) => updateRow(r.id, "date_added", e.target.value)} /></td>
                <td style={tdStyle}><input type="date" lang="en-US" dir="ltr" style={inputStyle} value={r.expiry_date || ""} onChange={(e) => updateRow(r.id, "expiry_date", e.target.value)} /></td>
                <td style={tdStyle}><input type="date" lang="en-US" dir="ltr" style={inputStyle} value={r.disposed_date || ""} onChange={(e) => updateRow(r.id, "disposed_date", e.target.value)} /></td>
                <td style={tdStyle}><input style={inputStyle} value={r.disposed_by} onChange={(e) => updateRow(r.id, "disposed_by", e.target.value)} /></td>
                <td style={tdStyle}><input style={inputStyle} value={r.note} onChange={(e) => updateRow(r.id, "note", e.target.value)} /></td>
                <td className="no-print" style={tdStyle}>
                  <button onClick={() => deleteRow(r.id)} style={{ background: "none", border: "none", color: "#C1432B" }}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #E1E8E5", fontSize: 11.5, color: "#7B8E8A", textTransform: "uppercase" };
const tdStyle = { padding: "6px 8px", borderBottom: "1px solid #F0F3F2" };
