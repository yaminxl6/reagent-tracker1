import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const inputStyle = { border: "1px solid #C7D1CE", borderRadius: 7, padding: "9px 11px", fontSize: 14, boxSizing: "border-box" };

function daysInMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export default function Charts({ reagents, logs }) {
  const names = [...new Set(reagents.map((r) => r.name))].sort();
  const [selected, setSelected] = useState(names[0] || "");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const lotsForReagent = useMemo(() => reagents.filter((r) => r.name === selected), [reagents, selected]);
  const lotIds = useMemo(() => new Set(lotsForReagent.map((r) => r.id)), [lotsForReagent]);
  const unit = lotsForReagent[0]?.unit || "";

  const monthLogs = useMemo(
    () => logs.filter((l) => lotIds.has(l.reagent_id) && !l.deleted && l.date.slice(0, 7) === month),
    [logs, lotIds, month]
  );
  const totalConsumedMonth = monthLogs.reduce((s, l) => s + l.amount, 0);

  const dailyData = useMemo(() => {
    const days = daysInMonth(month);
    const arr = Array.from({ length: days }, (_, i) => ({ day: String(i + 1), amount: 0 }));
    monthLogs.forEach((l) => {
      const d = Number(l.date.slice(8, 10));
      if (arr[d - 1]) arr[d - 1].amount += l.amount;
    });
    return arr;
  }, [monthLogs, month]);

  const deviceData = useMemo(() => {
    const map = {};
    lotsForReagent.forEach((r) => {
      const dev = r.device || "Unspecified";
      if (!map[dev]) map[dev] = { device: dev, received: 0, consumed: 0 };
      if (r.date_added.slice(0, 7) === month) map[dev].received += r.quantity_received;
    });
    monthLogs.forEach((l) => {
      const lot = lotsForReagent.find((r) => r.id === l.reagent_id);
      const dev = lot?.device || "Unspecified";
      if (!map[dev]) map[dev] = { device: dev, received: 0, consumed: 0 };
      map[dev].consumed += l.amount;
    });
    return Object.values(map);
  }, [lotsForReagent, monthLogs, month]);

  if (names.length === 0) {
    return <div style={{ textAlign: "center", padding: "60px 20px", color: "#8A9694", fontSize: 13.5 }}>No reagents logged yet — nothing to chart.</div>;
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Consumption charts</h2>
      <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 20 }}>Pick a reagent and a month to see daily usage and how much each device consumed vs received.</div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <label style={{ flex: 1, minWidth: 180 }}>
          <input list="charts-reagent-list" style={{ ...inputStyle, width: "100%" }} value={selected} onChange={(e) => setSelected(e.target.value)} placeholder="Search reagent…" />
          <datalist id="charts-reagent-list">
            {names.map((n) => <option key={n} value={n} />)}
          </datalist>
        </label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={inputStyle} />
      </div>

      {lotsForReagent.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#8A9694", fontSize: 13.5 }}>No matching reagent — pick one from the list.</div>
      ) : (
        <>
          <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#8A9694", fontWeight: 600, textTransform: "uppercase" }}>Total consumed — {month}</div>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{totalConsumedMonth} <span style={{ fontSize: 14, fontWeight: 500 }}>{unit}</span></div>
          </div>

          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 0.3 }}>DAILY CONSUMPTION</div>
          <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: 12, marginBottom: 26 }}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E1E8E5" />
                <XAxis dataKey="day" fontSize={11} stroke="#8A9694" />
                <YAxis fontSize={11} stroke="#8A9694" />
                <Tooltip formatter={(v) => [`${v} ${unit}`, "Consumed"]} labelFormatter={(d) => `Day ${d}`} />
                <Bar dataKey="amount" fill="#0F7173" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 0.3 }}>BY DEVICE — {month}</div>
          <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: 12 }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={deviceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E1E8E5" />
                <XAxis dataKey="device" fontSize={11} stroke="#8A9694" />
                <YAxis fontSize={11} stroke="#8A9694" />
                <Tooltip formatter={(v, n) => [`${v} ${unit}`, n]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="consumed" name="Consumed" fill="#C1432B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="received" name="Received" fill="#2F6B4F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
