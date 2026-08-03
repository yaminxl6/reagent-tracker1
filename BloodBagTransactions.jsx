import React, { useState, useEffect, useMemo } from "react";
import { Plus, X, Search, Lock } from "lucide-react";
import { supabase } from "./supabaseClient";
import SearchableSelect from "./SearchableSelect";

const ACTIONS = ["Expired", "Discarded", "Returned to Blood Bank"];
const REASONS = ["Contaminated", "Hemolyzed", "Broken Bag", "Leaking Bag", "Temperature Excursion", "Returned Too Late", "Improper Storage", "Other"];

const BADGE = {
  Expired: { text: "#B42318", bg: "#FEF3F2", border: "#FDA29B" },
  Discarded: { text: "#B54708", bg: "#FFF6ED", border: "#F9A461" },
  "Returned to Blood Bank": { text: "#175CD3", bg: "#EFF8FF", border: "#84CAFF" },
};

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function BloodBagTransactions({ username, role }) {
  const isAdmin = ["admin", "super", "owner"].includes(role);
  const [rows, setRows] = useState(null);
  const [bagOptions, setBagOptions] = useState([]); // [{bag, bloodType}]
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editing, setEditing] = useState(null); // row being edited by an admin

  async function loadAll() {
    const { data } = await supabase.from("blood_bag_transactions").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  }
  async function loadBagOptions() {
    const { data } = await supabase.from("fridge_inventory").select("lot_number, blood_type").in("refrigerator_name", ["FFP", "PRBCs"]);
    const map = {};
    (data || []).forEach((r) => { if (r.lot_number) map[r.lot_number] = r.blood_type || ""; });
    setBagOptions(Object.entries(map).map(([bag, bloodType]) => ({ bag, bloodType })));
  }
  useEffect(() => { loadAll(); loadBagOptions(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (rows || [])
      .filter((r) => (term ? r.bag_number.toLowerCase().includes(term) : true))
      .filter((r) => (filterAction === "All" ? true : r.action === filterAction))
      .filter((r) => (dateFrom ? r.txn_date >= dateFrom : true))
      .filter((r) => (dateTo ? r.txn_date <= dateTo : true));
  }, [rows, search, filterAction, dateFrom, dateTo]);

  async function saveRecord(form) {
    const payload = {
      bag_number: form.bagNumber, blood_type: form.bloodType, action: form.action,
      reason: form.action === "Discarded" ? form.reason : "",
      txn_date: form.date, performed_by: form.performedBy, note: form.note || "",
      locked: true,
    };
    if (form.id) {
      await supabase.from("blood_bag_transactions").update(payload).eq("id", form.id);
    } else {
      await supabase.from("blood_bag_transactions").insert(payload);
    }
    setShowForm(false);
    setEditing(null);
    loadAll();
  }

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 650, color: "#101828", margin: 0 }}>Blood Bag Transactions</h2>
          <div style={{ fontSize: 13, color: "#667085", marginTop: 3 }}>Every bag that has left inventory — expired, discarded, or returned to the central blood bank.</div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{ background: "#101828", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={15} /> Add record
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, margin: "20px 0", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} color="#98A2B3" style={{ position: "absolute", left: 12, top: 11 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by bag number"
            style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 12px 9px 34px", fontSize: 13.5, background: "#fff" }}
          />
        </div>
        <div style={{ display: "flex", gap: 4, background: "#F7F8FA", borderRadius: 10, padding: 3 }}>
          {["All", ...ACTIONS].map((a) => (
            <button
              key={a}
              onClick={() => setFilterAction(a)}
              style={{
                border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                background: filterAction === a ? "#fff" : "transparent",
                color: filterAction === a ? "#101828" : "#667085",
                boxShadow: filterAction === a ? "0 1px 2px rgba(16,24,40,0.06)" : "none",
              }}
            >
              {a === "Returned to Blood Bank" ? "Returned" : a}
            </button>
          ))}
        </div>
        <input type="date" lang="en-US" dir="ltr" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "8px 10px", fontSize: 13 }} />
        <span style={{ color: "#98A2B3", fontSize: 13 }}>to</span>
        <input type="date" lang="en-US" dir="ltr" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "8px 10px", fontSize: 13 }} />
      </div>

      <div style={{ background: "#fff", border: "1px solid #EEF1F4", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: "#FAFBFC" }}>
                {["Bag Number", "Blood Type", "Action", "Reason", "Date", "Performed By", "Note", ""].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered && filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 36, color: "#98A2B3", fontSize: 13.5 }}>No transactions recorded yet.</td></tr>
              )}
              {(filtered || []).map((r) => {
                const b = BADGE[r.action] || BADGE.Expired;
                return (
                  <tr key={r.id} className="bbt-row" style={{ borderTop: "1px solid #F0F2F5" }}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: "#101828" }}>{r.bag_number}</td>
                    <td style={tdStyle}>{r.blood_type || "—"}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: b.text, background: b.bg, border: `1px solid ${b.border}`, padding: "3px 9px", borderRadius: 20 }}>
                        {r.action === "Returned to Blood Bank" ? "Returned" : r.action}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: "#667085" }}>{r.reason || "—"}</td>
                    <td style={{ ...tdStyle, color: "#667085" }}>{r.txn_date}</td>
                    <td style={{ ...tdStyle, color: "#667085" }}>{r.performed_by}</td>
                    <td style={{ ...tdStyle, color: "#667085", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{r.note || "—"}</td>
                    <td style={tdStyle}>
                      {isAdmin ? (
                        <button onClick={() => setEditing(r)} style={{ background: "none", border: "1px solid #E5E7EB", color: "#667085", borderRadius: 7, padding: "4px 9px", fontSize: 11.5, fontWeight: 600 }}>Edit</button>
                      ) : (
                        <Lock size={13} color="#C7CBD1" title="Locked — admin only" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`.bbt-row:hover { background: #FAFBFC; }`}</style>

      {(showForm || editing) && (
        <RecordForm
          bagOptions={bagOptions}
          username={username}
          existing={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={saveRecord}
        />
      )}
    </div>
  );
}

function RecordForm({ bagOptions, username, existing, onClose, onSave }) {
  const [bagNumber, setBagNumber] = useState(existing?.bag_number || "");
  const [bloodType, setBloodType] = useState(existing?.blood_type || "");
  const [action, setAction] = useState(existing?.action || "");
  const [reason, setReason] = useState(existing?.reason || "");
  const [date, setDate] = useState(existing?.txn_date || todayISO());
  const [performedBy, setPerformedBy] = useState(existing?.performed_by || username || "");
  const [note, setNote] = useState(existing?.note || "");

  function pickBag(bag) {
    setBagNumber(bag);
    const match = bagOptions.find((o) => o.bag === bag);
    setBloodType(match ? match.bloodType : "");
  }

  const canSave = bagNumber && action && date && performedBy && (action !== "Discarded" || reason);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", padding: 24, boxShadow: "0 20px 60px rgba(16,24,40,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontWeight: 650, fontSize: 16, color: "#101828" }}>{existing ? "Edit record" : "Add record"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#98A2B3" }}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Bag Number">
            <SearchableSelect value={bagNumber} onChange={pickBag} options={bagOptions.map((o) => o.bag)} placeholder="Search bag number…" allowCustom={!existing} />
          </Field>

          <Field label="Blood Type">
            <input value={bloodType} readOnly placeholder="Loads after selecting a bag" style={{ ...inputStyle, background: "#F7F8FA", color: "#667085" }} />
          </Field>

          <Field label="Action">
            <select
              value={action}
              onChange={(e) => { setAction(e.target.value); if (e.target.value !== "Discarded") setReason(""); }}
              disabled={!!existing && !!existing.locked}
              style={{ ...inputStyle, background: existing?.locked ? "#F7F8FA" : "#fff", color: existing?.locked ? "#667085" : "#101828" }}
            >
              <option value="">Select an action…</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>

          {action === "Discarded" && (
            <Field label="Reason">
              <select value={reason} onChange={(e) => setReason(e.target.value)} style={inputStyle}>
                <option value="">Select a reason…</option>
                {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          )}

          {action && (
            <>
              <Field label={action === "Returned to Blood Bank" ? "Return Date" : "Date"}>
                <input type="date" lang="en-US" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Performed By">
                <input value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Note (optional)">
                <input value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} placeholder="Optional" />
              </Field>
            </>
          )}
        </div>

        <button
          onClick={() => onSave({ id: existing?.id, bagNumber, bloodType, action, reason, date, performedBy, note })}
          disabled={!canSave}
          style={{
            marginTop: 20, width: "100%", border: "none", borderRadius: 10, padding: "11px", fontWeight: 650, fontSize: 14,
            background: canSave ? "#101828" : "#EAECF0", color: canSave ? "#fff" : "#98A2B3", cursor: canSave ? "pointer" : "not-allowed",
          }}
        >
          {existing ? "Save changes" : "Save record"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#344054", marginBottom: 5 }}>{label}</div>
      {children}
    </label>
  );
}

const thStyle = { textAlign: "left", padding: "11px 16px", fontSize: 11.5, fontWeight: 650, color: "#667085", textTransform: "uppercase", letterSpacing: 0.3 };
const tdStyle = { padding: "12px 16px", color: "#344054" };
const inputStyle = { width: "100%", border: "1px solid #E5E7EB", borderRadius: 9, padding: "9px 11px", fontSize: 13.5, boxSizing: "border-box" };
