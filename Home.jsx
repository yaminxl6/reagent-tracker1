import React, { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { LayoutGrid, Refrigerator, Cpu, ChevronRight, AlertTriangle, Clock, Monitor, TrendingDown, TrendingUp, Bell, FlaskConical } from "lucide-react";

const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);
const fmtToday = () => new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

function firstNameCaps(username) {
  if (!username) return "";
  return username.split(/[.\s]/).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}
function roleLabel(role) {
  return { owner: "Owner", super: "Super Admin", admin: "Lab Admin", staff: "Lab Specialist" }[role] || "Lab Specialist";
}

const cardStyle = {
  background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16,
  boxShadow: "0 8px 24px rgba(0,0,0,0.06)", padding: 24,
};

function statusBadge(days) {
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, bg: "#FDECEC", color: "#DC2626" };
  if (days <= 30) return { label: `${days} days`, bg: "#FEF3E2", color: "#D97706" };
  if (days <= 60) return { label: `${days} days`, bg: "#E7F7F1", color: "#059669" };
  return { label: `${days} days`, bg: "#EFF4FE", color: "#2563EB" };
}

function ExpiryTable({ rows, today, onSelectGroup, emptyMsg }) {
  if (rows.length === 0) {
    return <div style={{ fontSize: 13, color: "#9CA3AF", padding: "16px 0" }}>{emptyMsg}</div>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Reagent", "Batch", "Expiry", "Status"].map((h) => (
              <th key={h} style={{ textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6B7280", padding: "0 0 10px", borderBottom: "1px solid #F3F4F6" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 5).map((g) => {
            const days = daysBetween(g.fefo.expiry_date, today);
            const badge = statusBadge(days);
            return (
              <tr key={g.name} onClick={() => onSelectGroup(g)} style={{ cursor: "pointer" }}>
                <td style={{ padding: "12px 0", fontSize: 13.5, fontWeight: 600, color: "#111827", borderBottom: "1px solid #F9FAFB" }}>{g.name}</td>
                <td style={{ padding: "12px 0", fontSize: 12.5, color: "#6B7280", fontFamily: "monospace", borderBottom: "1px solid #F9FAFB" }}>{g.fefo.lot_number}</td>
                <td style={{ padding: "12px 0", fontSize: 12.5, color: "#6B7280", borderBottom: "1px solid #F9FAFB" }}>{g.fefo.expiry_date}</td>
                <td style={{ padding: "12px 0", borderBottom: "1px solid #F9FAFB" }}>
                  <span style={{ background: badge.bg, color: badge.color, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{badge.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


export default function Home({ counts, groups, reagents, logs, devices, username, role, onNavigate, onSelectGroup }) {
  const today = todayISO();
  const [chartMonth, setChartMonth] = useState(today.slice(0, 7));

  const lowStockLots = useMemo(
    () => (reagents || [])
      .filter((r) => !r.deleted && r.current_quantity > 0 && r.current_quantity <= r.low_stock_threshold)
      .filter((r) => daysBetween(r.expiry_date, today) > -30)
      .sort((a, b) => a.current_quantity - b.current_quantity),
    [reagents, today]
  );

  const outOfStockLots = useMemo(
    () => (reagents || [])
      .filter((r) => !r.deleted && r.current_quantity <= 0)
      .filter((r) => daysBetween(r.expiry_date, today) > -30)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [reagents, today]
  );

  const [expirySort, setExpirySort] = useState("soonest");
  const expired = useMemo(
    () => (groups || [])
      .filter((g) => g.fefo && daysBetween(g.fefo.expiry_date, today) < 0)
      .sort((a, b) => expirySort === "soonest"
        ? new Date(a.fefo.expiry_date) - new Date(b.fefo.expiry_date)
        : new Date(b.fefo.expiry_date) - new Date(a.fefo.expiry_date)),
    [groups, today, expirySort]
  );
  const expiringSoon = useMemo(
    () => (groups || [])
      .filter((g) => g.fefo && daysBetween(g.fefo.expiry_date, today) >= 0 && daysBetween(g.fefo.expiry_date, today) <= 90)
      .sort((a, b) => expirySort === "soonest"
        ? new Date(a.fefo.expiry_date) - new Date(b.fefo.expiry_date)
        : new Date(b.fefo.expiry_date) - new Date(a.fefo.expiry_date)),
    [groups, today, expirySort]
  );

  const recentUsage = useMemo(() => {
    const byId = {};
    (reagents || []).forEach((r) => { byId[r.id] = r; });
    return (logs || [])
      .filter((l) => !l.deleted)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6)
      .map((l) => ({ ...l, reagent: byId[l.reagent_id] }))
      .filter((l) => l.reagent);
  }, [logs, reagents]);

  const deviceCount = useMemo(() => {
    const names = new Set([...(devices || []).map((d) => d.name), ...(reagents || []).map((r) => r.device).filter(Boolean)]);
    return names.size;
  }, [devices, reagents]);

  // Real month-over-month growth for the primary stat card (lots received).
  const growthPct = useMemo(() => {
    const thisMonthPrefix = today.slice(0, 7);
    const d = new Date(today); d.setMonth(d.getMonth() - 1);
    const lastMonthPrefix = d.toISOString().slice(0, 7);
    const thisMonthCount = (reagents || []).filter((r) => !r.deleted && r.date_added?.startsWith(thisMonthPrefix)).length;
    const lastMonthCount = (reagents || []).filter((r) => !r.deleted && r.date_added?.startsWith(lastMonthPrefix)).length;
    if (lastMonthCount === 0) return thisMonthCount > 0 ? 100 : 0;
    return Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100);
  }, [reagents, today]);

  const stats = [
    { label: "Total Reagents", value: (groups || []).length, icon: FlaskConical, color: "#2563EB", bg: "#EFF4FE", trend: growthPct },
    { label: "Low Stock", value: lowStockLots.length, icon: AlertTriangle, color: "#D97706", bg: "#FEF3E2" },
    { label: "Out of Stock", value: outOfStockLots.length, icon: AlertTriangle, color: "#7C2D12", bg: "#FDECEC" },
    { label: "Expiring Soon", value: expiringSoon.length, icon: Clock, color: "#2563EB", bg: "#EAF1FE" },
    { label: "Expired", value: expired.length, icon: Clock, color: "#DC2626", bg: "#FDECEC" },
    { label: "Connected Devices", value: deviceCount, icon: Monitor, color: "#059669", bg: "#E7F7F1" },
  ];

  // Usage Analytics — real daily totals for the selected month.
  const chartData = useMemo(() => {
    const [y, m] = chartMonth.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const totals = Array.from({ length: daysInMonth }, (_, i) => ({ day: String(i + 1), total: 0 }));
    (logs || []).forEach((l) => {
      if (l.deleted || !l.date.startsWith(chartMonth)) return;
      const dayIdx = Number(l.date.slice(8, 10)) - 1;
      if (totals[dayIdx]) totals[dayIdx].total += Number(l.amount) || 0;
    });
    return totals;
  }, [logs, chartMonth]);

  const monthOptions = useMemo(() => {
    const opts = [];
    const d = new Date(today);
    for (let i = 0; i < 6; i++) {
      opts.push(d.toISOString().slice(0, 7));
      d.setMonth(d.getMonth() - 1);
    }
    return opts;
  }, [today]);


  const tiles = [
    { key: "stock", label: "Reagents & Stock", desc: "Inventory, expiry, and consumption", icon: LayoutGrid },
    { key: "fridges", label: "Fridges", desc: "Monthly fridge & equipment counts", icon: Refrigerator },
    { key: "devices", label: "Devices", desc: "Reagent history & usage per device", icon: Cpu },
  ];

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Top bar */}
      <div className="dash-animate" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#111827", letterSpacing: -0.5 }}>Dashboard</div>
          <div style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>Overview of laboratory inventory</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280" }}>
            <Bell size={17} />
          </button>
          <div style={{ fontSize: 13, color: "#6B7280", fontWeight: 500 }}>{fmtToday()}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--accent-1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>
              {(firstNameCaps(username)[0] || "?").toUpperCase()}
            </div>
            <div style={{ display: window.innerWidth < 640 ? "none" : "block" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#111827" }}>{firstNameCaps(username) || "User"}</div>
              <div style={{ fontSize: 11.5, color: "#6B7280" }}>{roleLabel(role)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 1 — stat cards */}
      <div className="dash-animate" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24, marginBottom: 32 }}>
        {stats.map((s) => (
          <div key={s.label} className="dash-card" style={cardStyle}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <s.icon size={24} color={s.color} />
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
              <div style={{ fontSize: 13.5, color: "#6B7280", fontWeight: 500 }}>{s.label}</div>
              {typeof s.trend === "number" && (
                <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 700, color: s.trend >= 0 ? "#059669" : "#DC2626" }}>
                  {s.trend >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{Math.abs(s.trend)}%
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Row 2 — Expiring Soon + Expired tables */}
      <div className="dash-animate" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24, marginBottom: 32 }}>
        <div className="dash-card" style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Expiring Soon</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <select value={expirySort} onChange={(e) => setExpirySort(e.target.value)} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#374151", fontWeight: 500 }}>
                <option value="soonest">Soonest first</option>
                <option value="latest">Latest first</option>
              </select>
              <button onClick={() => onNavigate("stock")} style={{ background: "none", border: "none", color: "var(--accent-1)", fontSize: 13, fontWeight: 600 }}>View all</button>
            </div>
          </div>
          <ExpiryTable rows={expiringSoon} today={today} onSelectGroup={onSelectGroup} emptyMsg="Nothing expiring within 90 days." />
        </div>

        <div className="dash-card" style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#DC2626" }}>Expired</div>
            <button onClick={() => onNavigate("stock")} style={{ background: "none", border: "none", color: "var(--accent-1)", fontSize: 13, fontWeight: 600 }}>View all</button>
          </div>
          <ExpiryTable rows={expired} today={today} onSelectGroup={onSelectGroup} emptyMsg="Nothing expired right now." />
        </div>
      </div>

      {/* Row 2b — Usage Analytics chart, full width */}
      <div className="dash-animate" style={{ marginBottom: 32 }}>
        <div className="dash-card" style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Usage Analytics</div>
            <select value={chartMonth} onChange={(e) => setChartMonth(e.target.value)} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, color: "#374151", fontWeight: 500 }}>
              {monthOptions.map((m) => <option key={m} value={m}>{new Date(m + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 12.5 }} />
              <Area type="monotone" dataKey="total" stroke="#2563EB" strokeWidth={2.5} fill="url(#usageGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3 — Low Stock table + Recent Usage table */}
      <div className="dash-animate" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24, marginBottom: 32 }}>
        <div className="dash-card" style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Low Stock Alert</div>
            <button onClick={() => onNavigate("stock")} style={{ background: "none", border: "none", color: "var(--accent-1)", fontSize: 13, fontWeight: 600 }}>View all</button>
          </div>
          {lowStockLots.length === 0 ? (
            <div style={{ fontSize: 13, color: "#9CA3AF", padding: "16px 0" }}>Nothing below its low-stock threshold.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Reagent", "Current Stock", "Minimum", "Status"].map((h) => (
                      <th key={h} style={{ textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6B7280", padding: "0 0 10px", borderBottom: "1px solid #F3F4F6" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lowStockLots.slice(0, 5).map((r) => (
                    <tr key={r.id}>
                      <td style={{ padding: "12px 0", fontSize: 13.5, fontWeight: 600, color: "#111827", borderBottom: "1px solid #F9FAFB" }}>{r.name}</td>
                      <td style={{ padding: "12px 0", fontSize: 12.5, color: "#6B7280", borderBottom: "1px solid #F9FAFB" }}>{r.current_quantity} {r.unit}</td>
                      <td style={{ padding: "12px 0", fontSize: 12.5, color: "#6B7280", borderBottom: "1px solid #F9FAFB" }}>{r.low_stock_threshold} {r.unit}</td>
                      <td style={{ padding: "12px 0", borderBottom: "1px solid #F9FAFB" }}>
                        <span style={{ background: "#FDECEC", color: "#DC2626", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>Low</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="dash-card" style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#7C2D12" }}>Out of Stock</div>
            <button onClick={() => onNavigate("stock")} style={{ background: "none", border: "none", color: "var(--accent-1)", fontSize: 13, fontWeight: 600 }}>View all</button>
          </div>
          {outOfStockLots.length === 0 ? (
            <div style={{ fontSize: 13, color: "#9CA3AF", padding: "16px 0" }}>Nothing is fully out of stock.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Reagent", "Last known", "Status"].map((h) => (
                      <th key={h} style={{ textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6B7280", padding: "0 0 10px", borderBottom: "1px solid #F3F4F6" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {outOfStockLots.slice(0, 5).map((r) => (
                    <tr key={r.id}>
                      <td style={{ padding: "12px 0", fontSize: 13.5, fontWeight: 600, color: "#111827", borderBottom: "1px solid #F9FAFB" }}>{r.name}</td>
                      <td style={{ padding: "12px 0", fontSize: 12.5, color: "#6B7280", borderBottom: "1px solid #F9FAFB" }}>0 / {r.quantity_received} {r.unit}</td>
                      <td style={{ padding: "12px 0", borderBottom: "1px solid #F9FAFB" }}>
                        <span style={{ background: "#FDECEC", color: "#7C2D12", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>Out of stock</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="dash-card" style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 16 }}>Recent Usage</div>
          {recentUsage.length === 0 ? (
            <div style={{ fontSize: 13, color: "#9CA3AF", padding: "16px 0" }}>No usage logged yet.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Reagent", "Used By", "Device", "Time", "Qty"].map((h) => (
                      <th key={h} style={{ textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6B7280", padding: "0 0 10px", borderBottom: "1px solid #F3F4F6" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentUsage.map((l) => (
                    <tr key={l.id}>
                      <td style={{ padding: "12px 0", fontSize: 13.5, fontWeight: 600, color: "#111827", borderBottom: "1px solid #F9FAFB" }}>{l.reagent.name}</td>
                      <td style={{ padding: "12px 0", fontSize: 12.5, color: "#6B7280", borderBottom: "1px solid #F9FAFB" }}>{l.used_by}</td>
                      <td style={{ padding: "12px 0", fontSize: 12.5, color: "#6B7280", borderBottom: "1px solid #F9FAFB" }}>{l.reagent.device || "—"}</td>
                      <td style={{ padding: "12px 0", fontSize: 12.5, color: "#6B7280", borderBottom: "1px solid #F9FAFB" }}>{l.date}</td>
                      <td style={{ padding: "12px 0", fontSize: 12.5, fontWeight: 600, color: "#111827", borderBottom: "1px solid #F9FAFB" }}>{l.amount} {l.reagent.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="dash-animate" style={{ fontSize: 12.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Quick links</div>
      <div className="dash-animate" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => onNavigate(t.key)} className="dash-card" style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", textAlign: "left", cursor: "pointer" }}>
              <div style={{ background: "#EFF4FE", borderRadius: 12, padding: 11, display: "flex" }}>
                <Icon size={20} color="var(--accent-1)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: "#111827" }}>{t.label}</div>
                <div style={{ fontSize: 12.5, color: "#6B7280" }}>{t.desc}</div>
              </div>
              <ChevronRight size={18} color="#D1D5DB" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
