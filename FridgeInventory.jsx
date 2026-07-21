import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Download, Refrigerator, Printer, Save, CheckCircle2, ArrowLeft, Pencil } from "lucide-react";
import { supabase } from "./supabaseClient";
import FridgeIcon from "./FridgeIcon";
import FridgeImport from "./FridgeImport";

const inputStyle = { border: "1px solid #C7D1CE", borderRadius: 6, padding: "6px 8px", fontSize: 13, boxSizing: "border-box" };
const labelStyle = { fontSize: 12.5, fontWeight: 600, color: "#516361" };
const todayMonth = () => new Date().toISOString().slice(0, 7);
// Your lab's fridges — always shown as cards here, even before any stock
// count or temperature reading has been entered for them yet.
const BASE_FRIDGES = ["R011", "R014", "R009", "R01", "Lab0202", "R012", "R0008"];
const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function displayMonth(monthISO) {
  const [y, m] = monthISO.split("-");
  return `${m}-${y}`;
}
function isTempId(id) {
  return String(id).startsWith("temp-");
}

export default function FridgeInventory({ username, logActivity }) {
  const [all, setAll] = useState(null);
  const [month, setMonth] = useState(todayMonth());
  const [refrigeratorName, setRefrigeratorName] = useState("");
  const [countedBy, setCountedBy] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [deletedIds, setDeletedIds] = useState([]);
  const [tempLogs, setTempLogs] = useState([]);
  const [liveStock, setLiveStock] = useState([]);

  async function loadLiveStock(fridgeName) {
    if (!fridgeName) { setLiveStock([]); return; }
    const { data } = await supabase.from("reagents").select("*").eq("fridge_name", fridgeName).eq("deleted", false).order("name");
    setLiveStock((data || []).filter((r) => r.current_quantity > 0));
  }

  async function loadAll() {
    const { data } = await supabase.from("fridge_inventory").select("*").order("row_order");
    setAll(data || []);
    setDirty(false);
    setDeletedIds([]);
  }
  async function loadTemps() {
    const { data } = await supabase.from("fridge_temperature_logs").select("*").order("date", { ascending: false });
    setTempLogs(data || []);
  }
  useEffect(() => { loadAll(); loadTemps(); }, []);
  useEffect(() => { loadLiveStock(refrigeratorName); }, [refrigeratorName]);

  // Opening a fridge for a month that has no count yet: carry forward the
  // most recent prior month's items as a starting point, so staff only
  // update quantities/expiry instead of re-typing the whole sheet.
  useEffect(() => {
    if (!refrigeratorName || all === null) return;
    const existing = all.filter((r) => r.month === month && r.refrigerator_name === refrigeratorName);
    if (existing.length > 0) return;
    const priorRows = all.filter((r) => r.refrigerator_name === refrigeratorName && r.month < month);
    if (priorRows.length === 0) return;
    const latestPriorMonth = priorRows.reduce((m, r) => (r.month > m ? r.month : m), priorRows[0].month);
    const carryOver = priorRows
      .filter((r) => r.month === latestPriorMonth)
      .map((r, i) => ({
        id: `temp-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        month, refrigerator_name: refrigeratorName, counted_by: countedBy,
        added_by: username || "", edited_by: "", edited_at: null,
        device_group: r.device_group, item_name: r.item_name, lot_number: r.lot_number,
        quantity: r.quantity, expiry_date: r.expiry_date, row_order: r.row_order,
      }));
    setAll((a) => [...a, ...carryOver]);
    setDirty(true);
  }, [refrigeratorName, month, all]);

  async function renameFridge(oldName, newName) {
    if (!newName || newName === oldName) return;
    await supabase.from("fridge_inventory").update({ refrigerator_name: newName }).eq("refrigerator_name", oldName);
    // Keep reagent lots and temperature history linked to the fridge in sync.
    await supabase.from("reagents").update({ fridge_name: newName }).eq("fridge_name", oldName);
    await supabase.from("fridge_temperature_logs").update({ fridge_name: newName }).eq("fridge_name", oldName);
    await logActivity?.("settings_change", "config", `Renamed fridge "${oldName}" → "${newName}"`);
    loadAll();
    loadTemps();
  }

  const fridgeNames = useMemo(() => [...new Set([...BASE_FRIDGES, ...(all || []).map((r) => r.refrigerator_name)])].sort(), [all]);
  const itemSuggestions = useMemo(() => [...new Set((all || []).map((r) => r.item_name))], [all]);
  const deviceSuggestions = useMemo(() => [...new Set((all || []).map((r) => r.device_group).filter(Boolean))], [all]);
  const itemCountFor = (name) => (all || []).filter((r) => r.refrigerator_name === name && r.month === month && r.item_name).length;

  const currentRows = (all || []).filter((r) => r.month === month && r.refrigerator_name === refrigeratorName);
  const _now = new Date();
  const today = new Date(_now.getTime() - _now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  function isArchivedRow(r) {
    if (!r.expiry_date) return false;
    return Math.round((new Date(r.expiry_date) - new Date(today)) / 86400000) <= -30;
  }
  const groups = useMemo(() => {
    const map = {};
    currentRows.filter((r) => !isArchivedRow(r)).forEach((r) => {
      const key = r.device_group || "General";
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [currentRows]);

  function addRow(deviceGroup) {
    const maxOrder = currentRows.reduce((m, r) => Math.max(m, r.row_order || 0), 0);
    const tempRow = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      month, refrigerator_name: refrigeratorName, counted_by: countedBy,
      added_by: username || "", edited_by: "", edited_at: null,
      device_group: deviceGroup, item_name: "", lot_number: "", quantity: "", expiry_date: null, row_order: maxOrder + 1,
    };
    setAll((a) => [...a, tempRow]);
    setDirty(true);
  }

  function addSection() {
    const name = prompt("New device/section name (e.g. VIDAS):");
    if (!name) return;
    addRow(name);
  }

  function updateRow(id, field, value) {
    setAll((a) => a.map((r) => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if (!isTempId(id)) { updated.edited_by = username || ""; updated.edited_at = new Date().toISOString(); }
      return updated;
    }));
    setDirty(true);
  }

  function deleteRow(id) {
    setAll((a) => a.filter((r) => r.id !== id));
    if (!isTempId(id)) setDeletedIds((d) => [...d, id]);
    setDirty(true);
  }

  async function saveAll() {
    setSaveMsg("Saving…");
    if (deletedIds.length) {
      await supabase.from("fridge_inventory").delete().in("id", deletedIds);
    }
    const toInsert = currentRows.filter((r) => isTempId(r.id)).map((r) => {
      const { id, ...rest } = r;
      return rest;
    });
    const toUpdate = currentRows.filter((r) => !isTempId(r.id));

    if (toInsert.length) await supabase.from("fridge_inventory").insert(toInsert);
    for (const r of toUpdate) {
      await supabase.from("fridge_inventory").update({
        item_name: r.item_name, lot_number: r.lot_number, quantity: r.quantity, expiry_date: r.expiry_date, counted_by: r.counted_by,
        edited_by: r.edited_by || "", edited_at: r.edited_at || null,
      }).eq("id", r.id);
    }
    await logActivity?.("fridge_count", "fridge", `${refrigeratorName} — ${month}: ${toInsert.length} new row(s), ${toUpdate.length} updated`);
    await loadAll();
    setSaveMsg("Saved ✓");
    setTimeout(() => setSaveMsg(""), 2500);
  }

  async function handleFridgeImport({ month: importMonth, refrigeratorName: importFridge, rows }) {
    const maxOrder = (all || []).filter((r) => r.month === importMonth && r.refrigerator_name === importFridge).reduce((m, r) => Math.max(m, r.row_order || 0), 0);
    const toInsert = rows.map((r, i) => ({
      month: importMonth,
      refrigerator_name: importFridge,
      counted_by: countedBy,
      device_group: r.device_group || "",
      item_name: r.item_name,
      lot_number: r.lot_number || "",
      quantity: r.quantity || "",
      expiry_date: r.expiry_date || null,
      row_order: maxOrder + i + 1,
    }));
    await supabase.from("fridge_inventory").insert(toInsert);
    await logActivity?.("fridge_count", "fridge", `${importFridge} — ${importMonth}: imported ${toInsert.length} row(s) from file`);
    setMonth(importMonth);
    setRefrigeratorName(importFridge);
    await loadAll();
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {saveMsg && <span style={{ fontSize: 12.5, color: "#2F6B4F", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={13} /> {saveMsg}</span>}
          <button onClick={() => window.print()} style={{ background: "none", border: "1px solid #C7D1CE", color: "#516361", borderRadius: 7, padding: "8px 12px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Printer size={14} /> Print</button>
          <button onClick={exportExcel} style={{ background: "var(--accent-2)", color: "#fff", border: "none", borderRadius: 7, padding: "8px 12px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Download size={14} /> Export Excel</button>
          <button onClick={saveAll} disabled={!dirty} style={{ background: dirty ? "var(--accent-1)" : "#C7D1CE", color: "#fff", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, cursor: dirty ? "pointer" : "default" }}><Save size={14} /> Save</button>
        </div>
      </div>
      <div className="no-print" style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 20 }}>Monthly stock count sheet — matches your paper form. Not shown in Reports. Edits are local until you press <b>Save</b>.</div>

      <div className="no-print" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "flex-end" }}>
        <label style={labelStyle}>Month
          <input type="month" style={inputStyle} value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        {refrigeratorName && (
          <>
            <button onClick={() => setRefrigeratorName("")} style={{ background: "none", border: "1px solid #C7D1CE", color: "#516361", borderRadius: 7, padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>← All fridges</button>
            <label style={{ ...labelStyle, flex: 1, minWidth: 160 }}>Counted by
              <input style={{ ...inputStyle, width: "100%" }} value={countedBy} onChange={(e) => setCountedBy(e.target.value)} />
            </label>
          </>
        )}
      </div>

      {!refrigeratorName ? (
        <>
          <div className="no-print" style={{ marginBottom: 18 }}>
            <FridgeImport onApply={handleFridgeImport} />
          </div>
          <FridgePicker fridgeNames={fridgeNames} all={all} month={month} onSelect={setRefrigeratorName} onRename={renameFridge} />
        </>
      ) : (
        <div id="fridge-print-area">
          <div style={{ textAlign: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Reagent inventory</div>
            <div style={{ fontSize: 12.5, color: "#7B8E8A" }}>month: {displayMonth(month)}</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, margin: "14px 0 8px" }}>Refrigerator: {refrigeratorName}</div>

          <TemperatureLog
            fridgeName={refrigeratorName}
            logs={tempLogs.filter((t) => t.fridge_name === refrigeratorName)}
            username={username}
            onAdded={async (row) => {
              await supabase.from("fridge_temperature_logs").insert(row);
              await logActivity?.("fridge_count", "fridge", `${refrigeratorName} — temperature logged: ${row.temperature}°C on ${row.date}`);
              await loadTemps();
            }}
          />

          <LiveStockPanel stock={liveStock} />

          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #C7D1CE" }}>
            <thead>
              <tr>
                <th style={thStyle}>Item</th>
                <th style={thStyle}>Unit</th>
                <th style={thStyle}>Quantity</th>
                <th style={thStyle}>Expiry date</th>
                <th className="no-print" style={{ ...thStyle, width: 140 }}>Signed</th>
                <th className="no-print" style={{ ...thStyle, width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groups).map(([section, rows]) => (
                <React.Fragment key={section}>
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", fontWeight: 700, background: "#F7F9F8", border: "1px solid #C7D1CE", padding: "6px 0" }}>#{section}</td>
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
                        <input type="date" lang="en-US" dir="ltr" style={cellInputStyle} value={r.expiry_date || ""} onChange={(e) => updateRow(r.id, "expiry_date", e.target.value)} />
                      </td>
                      <td className="no-print" style={{ ...tdStyle, fontSize: 11, color: "#7B8E8A" }}>
                        {r.edited_by ? (
                          <span title={r.edited_at ? new Date(r.edited_at).toLocaleString() : ""}>edited: {r.edited_by}</span>
                        ) : r.added_by ? (
                          <span>added: {r.added_by}</span>
                        ) : "—"}
                      </td>
                      <td className="no-print" style={{ ...tdStyle, textAlign: "center" }}>
                        <button onClick={() => deleteRow(r.id)} style={{ background: "none", border: "none", color: "#C1432B" }}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                  <tr className="no-print">
                    <td colSpan={6} style={{ border: "1px solid #C7D1CE", padding: 4 }}>
                      <button onClick={() => addRow(section)} style={{ background: "none", border: "none", color: "var(--accent-1)", fontSize: 12, fontWeight: 600 }}>+ Add row to #{section}</button>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>

          <datalist id="item-suggestions">{itemSuggestions.map((n) => <option key={n} value={n} />)}</datalist>

          <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
            <button onClick={addSection} style={{ background: "none", border: "1px dashed var(--accent-1)", color: "var(--accent-1)", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> Add device section {deviceSuggestions.length > 0 ? `(existing: ${deviceSuggestions.join(", ")})` : ""}
            </button>
            <button onClick={saveAll} disabled={!dirty} style={{ background: dirty ? "var(--accent-1)" : "#C7D1CE", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, cursor: dirty ? "pointer" : "default" }}>
              <Save size={14} /> Save {dirty ? "(unsaved changes)" : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Real current stock — pulled live from the reagents table (what's actually
// received and not yet used up), linked via each lot's fridge_name. This is
// separate from the manual monthly count below, which matches the paper form.
function LiveStockPanel({ stock }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="no-print" style={{ border: "1px solid #E1E8E5", borderRadius: 8, padding: "10px 12px", marginBottom: 14, background: "#EAF6F4" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Current stock actually in this fridge ({stock.length} lot(s), live from device records)</div>
        <button onClick={() => setOpen((o) => !o)} style={{ background: "none", border: "1px solid #C7D1CE", color: "#516361", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600 }}>
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open && (
        stock.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#8A9694", marginTop: 8 }}>No active lots currently linked to this fridge.</div>
        ) : (
          <div style={{ marginTop: 10, maxHeight: 260, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyleSmall}>Reagent</th>
                  <th style={thStyleSmall}>Lot</th>
                  <th style={thStyleSmall}>Device</th>
                  <th style={thStyleSmall}>Qty left</th>
                  <th style={thStyleSmall}>Expiry</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((r) => (
                  <tr key={r.id}>
                    <td style={tdStyleSmall}>{r.name}</td>
                    <td style={tdStyleSmall}>{r.lot_number}</td>
                    <td style={tdStyleSmall}>{r.device || "—"}</td>
                    <td style={tdStyleSmall}>{r.current_quantity} {r.unit}</td>
                    <td style={tdStyleSmall}>{r.expiry_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

// Standard lab fridges run 2–8°C; R014 holds items that need freezing
// (per your note), so it's checked against a freezer range instead.
const FREEZER_FRIDGES = ["R014"];
function tempRangeFor(fridgeName) {
  return FREEZER_FRIDGES.includes(fridgeName) ? { min: -20, max: -18, label: "-20 to -18°C" } : { min: 2, max: 8, label: "2 to 8°C" };
}

function TemperatureLog({ fridgeName, logs, username, onAdded }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [temperature, setTemperature] = useState("");
  const range = tempRangeFor(fridgeName);

  async function submit() {
    if (!temperature) return;
    await onAdded({ fridge_name: fridgeName, date, temperature: Number(temperature), recorded_by: username || "" });
    setTemperature("");
  }

  const sorted = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latest = sorted[0];
  const latestOutOfRange = latest && (latest.temperature < range.min || latest.temperature > range.max);

  return (
    <div className="no-print" style={{ border: "1px solid #E1E8E5", borderRadius: 8, padding: "10px 12px", marginBottom: 14, background: "#F7F9F8" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          Temperature {latest ? <>— last reading <b style={{ color: latestOutOfRange ? "#C1432B" : "inherit" }}>{latest.temperature}°C</b> on {latest.date} {latestOutOfRange && <span style={{ color: "#C1432B", fontWeight: 700 }}>⚠ out of range ({range.label})</span>}</> : <span style={{ color: "#8A9694", fontWeight: 500 }}>— no readings yet · normal range {range.label}</span>}
        </div>
        <button onClick={() => setOpen((o) => !o)} style={{ background: "none", border: "1px solid #C7D1CE", color: "#516361", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600 }}>
          {open ? "Hide history" : `History (${logs.length})`}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 10, flexWrap: "wrap" }}>
        <label style={labelStyle}>Date<input type="date" lang="en-US" dir="ltr" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label style={labelStyle}>Temp (°C)<input type="number" step="0.1" style={{ ...inputStyle, width: 90 }} value={temperature} onChange={(e) => setTemperature(e.target.value)} /></label>
        <button onClick={submit} style={{ background: "var(--accent-1)", color: "#fff", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 700 }}>+ Log reading</button>
      </div>
      {open && (
        <div style={{ marginTop: 10, maxHeight: 220, overflowY: "auto" }}>
          {sorted.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#8A9694" }}>No temperature history for this fridge yet.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyleSmall }}>Date</th>
                  <th style={{ ...thStyleSmall }}>Temp (°C)</th>
                  <th style={{ ...thStyleSmall }}>Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => {
                  const outOfRange = t.temperature < range.min || t.temperature > range.max;
                  return (
                    <tr key={t.id}>
                      <td style={tdStyleSmall}>{t.date}</td>
                      <td style={{ ...tdStyleSmall, color: outOfRange ? "#C1432B" : "inherit", fontWeight: outOfRange ? 700 : 400 }}>{t.temperature}{outOfRange ? " ⚠" : ""}</td>
                      <td style={tdStyleSmall}>{t.recorded_by || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
const thStyleSmall = { textAlign: "left", fontSize: 11.5, color: "#7B8E8A", padding: "4px 6px", borderBottom: "1px solid #E1E8E5" };
const tdStyleSmall = { fontSize: 12.5, padding: "4px 6px", borderBottom: "1px solid #EEF2F0" };

const thStyle = { border: "1px solid #C7D1CE", padding: "8px 10px", fontSize: 12.5, fontWeight: 700, background: "#F0F3F2", textAlign: "left" };
const tdStyle = { border: "1px solid #C7D1CE", padding: "4px 6px" };
const cellInputStyle = { border: "none", background: "transparent", fontSize: 13, width: "100%", padding: "4px 2px" };

function FridgePicker({ fridgeNames, all, month, onSelect, onRename }) {
  const [newName, setNewName] = useState("");
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 14, marginBottom: 18 }}>
        {fridgeNames.map((name) => {
          const items = [...new Set((all || []).filter((r) => r.refrigerator_name === name && r.month === month).map((r) => r.item_name).filter(Boolean))];
          return <FridgeCard key={name} name={name} items={items} onClick={() => onSelect(name)} onRename={(newN) => onRename(name, newN)} />;
        })}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", maxWidth: 340 }}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New fridge name…" style={{ ...inputStyle, flex: 1 }} />
        <button onClick={() => newName.trim() && onSelect(newName.trim())} style={{ background: "var(--accent-1)", color: "#fff", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 700 }}>+ Add fridge</button>
      </div>
    </div>
  );
}

// A CSS-drawn fridge: a body with a translucent "glass" window showing small
// chips for whatever's currently logged inside, and the name on top.
function FridgeCard({ name, items, onClick, onRename }) {
  function handleRename(e) {
    e.stopPropagation();
    const newName = prompt(`Rename "${name}" to:`, name);
    if (newName && newName.trim() && newName.trim() !== name) onRename(newName.trim());
  }
  return (
    <div style={{ textAlign: "center" }}>
      <div onClick={onClick} style={{ width: "100%", aspectRatio: "3/4", background: "linear-gradient(160deg, #EAF0F5 0%, #D5E0E8 100%)", border: "2px solid #B7C3C0", borderRadius: 14, position: "relative", overflow: "hidden", boxShadow: "0 3px 8px rgba(0,0,0,0.08)", cursor: "pointer" }}>
        {onRename && (
          <button onClick={handleRename} title="Rename fridge" style={{ position: "absolute", top: 6, right: 6, zIndex: 2, background: "rgba(255,255,255,0.85)", border: "none", borderRadius: 6, padding: 4, display: "flex" }}>
            <Pencil size={12} color="#516361" />
          </button>
        )}
        <div style={{ position: "absolute", top: "18%", left: 0, right: 0, height: 2, background: "#B7C3C0" }} />
        <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 26, height: 5, borderRadius: 3, background: "#9FB0AE" }} />
        <div style={{ position: "absolute", top: "26%", left: "50%", transform: "translateX(-50%)", width: 8, height: 8, borderRadius: 4, background: "#8A9694" }} />
        <div style={{ position: "absolute", top: "20%", bottom: 10, left: 10, right: 10, background: "rgba(255,255,255,0.35)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.6)", backdropFilter: "blur(1px)", display: "flex", flexWrap: "wrap", gap: 4, alignContent: "flex-start", padding: 8, overflow: "hidden" }}>
          {items.length === 0 ? (
            <span style={{ fontSize: 10.5, color: "#7B8E8A", margin: "auto" }}>empty</span>
          ) : (
            items.slice(0, 8).map((it) => (
              <span key={it} style={{ background: "var(--accent-2)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>{it}</span>
            ))
          )}
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, marginTop: 8 }}>{name}</div>
    </div>
  );
}
