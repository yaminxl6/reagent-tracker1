import React, { useState, useMemo } from "react";
import { Package, Search } from "lucide-react";

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);

export default function Batches({ reagents, departments }) {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const today = todayISO();

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (reagents || [])
      .filter((r) => !r.deleted)
      .filter((r) => (deptFilter ? r.department === deptFilter : true))
      .filter((r) => (term ? r.name.toLowerCase().includes(term) || r.lot_number.toLowerCase().includes(term) || (r.device || "").toLowerCase().includes(term) : true))
      .sort((a, b) => new Date(b.date_added) - new Date(a.date_added));
  }, [reagents, search, deptFilter]);

  function statusFor(r) {
    const days = daysBetween(r.expiry_date, today);
    if (days < 0 || r.current_quantity <= 0) return { label: "Expired/Out", bg: "#FBEAE6", color: "#C1432B" };
    if (r.current_quantity <= r.low_stock_threshold) return { label: "Low stock", bg: "#FBF0E2", color: "#8A6D2F" };
    if (days <= 30) return { label: `${days}d left`, bg: "#FBF0E2", color: "#8A6D2F" };
    return { label: "Active", bg: "#E8F2EC", color: "#2F6B4F" };
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><Package size={20} /> Batches</h2>
      <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 20 }}>Every reagent lot in inventory, in one flat list.</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <Search size={14} color="#8A9694" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reagent, batch number, or device…"
            style={{ width: "100%", border: "1px solid #C7D1CE", borderRadius: 8, padding: "10px 12px 10px 34px", fontSize: 14, boxSizing: "border-box" }}
          />
        </div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} style={{ border: "1px solid #C7D1CE", borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff", minWidth: 160 }}>
          <option value="">All departments</option>
          {(departments || []).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#8A9694", fontSize: 13.5 }}>No matching batches.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, overflow: "hidden" }}>
            <thead>
              <tr style={{ background: "#F0F3F2", textAlign: "left" }}>
                {["Reagent", "Batch No.", "Device", "Received", "Expiry", "Qty", "Status"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 12, color: "#7B8E8A", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = statusFor(r);
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid #EEF2F0" }}>
                    <td style={{ padding: "10px 14px", fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap" }}>{r.name}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{r.lot_number}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "#516361", whiteSpace: "nowrap" }}>{r.device || "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "#516361", whiteSpace: "nowrap" }}>{r.date_added}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "#516361", whiteSpace: "nowrap" }}>{r.expiry_date}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, whiteSpace: "nowrap" }}>{r.current_quantity}/{r.quantity_received} {r.unit}</td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20 }}>{s.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
