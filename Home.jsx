import React, { useMemo } from "react";
import { LayoutGrid, Refrigerator, Cpu, ChevronRight, AlertTriangle, Clock, Monitor, TrendingDown } from "lucide-react";

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);

export default function Home({ counts, groups, reagents, logs, devices, onNavigate, onSelectGroup }) {
  const today = todayISO();

  const lowStockLots = useMemo(
    () => (reagents || []).filter((r) => !r.deleted && r.current_quantity <= r.low_stock_threshold).sort((a, b) => a.current_quantity - b.current_quantity),
    [reagents]
  );

  const expiringSoon = useMemo(
    () => (groups || []).filter((g) => g.fefo && daysBetween(g.fefo.expiry_date, today) <= 90).sort((a, b) => new Date(a.fefo.expiry_date) - new Date(b.fefo.expiry_date)),
    [groups, today]
  );

  const recentUsage = useMemo(() => {
    const byId = {};
    (reagents || []).forEach((r) => { byId[r.id] = r; });
    return (logs || [])
      .filter((l) => !l.deleted)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5)
      .map((l) => ({ ...l, reagent: byId[l.reagent_id] }))
      .filter((l) => l.reagent);
  }, [logs, reagents]);

  const deviceCount = useMemo(() => {
    const names = new Set([...(devices || []).map((d) => d.name), ...(reagents || []).map((r) => r.device).filter(Boolean)]);
    return names.size;
  }, [devices, reagents]);

  const stats = [
    { label: "Total Reagents", value: (groups || []).length, icon: LayoutGrid, color: "#2F6FED", bg: "#EAF1FE" },
    { label: "Low Stock Items", value: lowStockLots.length, icon: AlertTriangle, color: "#D8862B", bg: "#FBF0E2" },
    { label: "Expiring Soon", value: expiringSoon.length, icon: Clock, color: "#C1432B", bg: "#FBEAE6" },
    { label: "Total Devices", value: deviceCount, icon: Monitor, color: "#2F8F5B", bg: "#E8F2EC" },
  ];

  const tiles = [
    { key: "stock", label: "Reagents & Stock", desc: "Inventory, expiry, and consumption", icon: LayoutGrid },
    { key: "fridges", label: "Fridges", desc: "Monthly fridge & equipment counts", icon: Refrigerator },
    { key: "devices", label: "Devices", desc: "Reagent history & usage per device", icon: Cpu },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Dashboard</h2>
      <div style={{ fontSize: 13, color: "#8A93A0", marginBottom: 20 }}>Overview of reagents, usage, and inventory status.</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid #EDEFF2", borderRadius: 12, padding: "16px 16px", boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <s.icon size={18} color={s.color} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1B2328" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#8A93A0", fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid #EDEFF2", borderRadius: 12, padding: 18, marginBottom: 16, boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Expiring Soon</div>
          <button onClick={() => onNavigate("stock")} style={{ background: "none", border: "none", color: "#2F6FED", fontSize: 12.5, fontWeight: 600 }}>View all</button>
        </div>
        {expiringSoon.length === 0 ? (
          <div style={{ fontSize: 13, color: "#8A93A0", padding: "8px 0" }}>Nothing expiring within 90 days.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {expiringSoon.slice(0, 5).map((g) => {
              const days = daysBetween(g.fefo.expiry_date, today);
              const late = days < 0;
              return (
                <button key={g.name} onClick={() => onSelectGroup(g)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", borderTop: "1px solid #F3F4F6", padding: "10px 0", textAlign: "left" }}>
                  <div style={{ flex: 1, fontWeight: 600, fontSize: 13.5, color: "#1B2328" }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: "#8A93A0", fontFamily: "monospace" }}>{g.fefo.lot_number}</div>
                  <div style={{ fontSize: 12, color: "#8A93A0" }}>{g.fefo.expiry_date}</div>
                  <span style={{ background: late ? "#FBEAE6" : days <= 30 ? "#FBF0E2" : "#E8F2EC", color: late ? "#C1432B" : days <= 30 ? "#8A6D2F" : "#2F6B4F", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20 }}>
                    {late ? "expired" : `${days}d`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ background: "#fff", border: "1px solid #EDEFF2", borderRadius: 12, padding: 18, marginBottom: 16, boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Low Stock Alert</div>
          <button onClick={() => onNavigate("stock")} style={{ background: "none", border: "none", color: "#2F6FED", fontSize: 12.5, fontWeight: 600 }}>View all</button>
        </div>
        {lowStockLots.length === 0 ? (
          <div style={{ fontSize: 13, color: "#8A93A0", padding: "8px 0" }}>Nothing below its low-stock threshold.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {lowStockLots.slice(0, 5).map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid #F3F4F6", padding: "10px 0" }}>
                <div style={{ flex: 1, fontWeight: 600, fontSize: 13.5, color: "#1B2328" }}>{r.name}</div>
                <div style={{ fontSize: 12, color: "#8A93A0" }}>{r.current_quantity} / {r.low_stock_threshold} {r.unit}</div>
                <span style={{ background: "#FBEAE6", color: "#C1432B", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20 }}>Low</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: "#fff", border: "1px solid #EDEFF2", borderRadius: 12, padding: 18, marginBottom: 24, boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Recent Usage</div>
        {recentUsage.length === 0 ? (
          <div style={{ fontSize: 13, color: "#8A93A0", padding: "8px 0" }}>No usage logged yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {recentUsage.map((l) => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid #F3F4F6", padding: "10px 0" }}>
                <TrendingDown size={14} color="#8A93A0" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, fontWeight: 600, fontSize: 13.5, color: "#1B2328" }}>{l.reagent.name}</div>
                <div style={{ fontSize: 12, color: "#8A93A0" }}>{l.used_by}</div>
                <div style={{ fontSize: 12, color: "#8A93A0" }}>{l.date}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1B2328" }}>−{l.amount} {l.reagent.unit}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, color: "#8A93A0", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>Quick links</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => onNavigate(t.key)} style={{ display: "flex", alignItems: "center", gap: 16, background: "#fff", border: "1px solid #EDEFF2", borderRadius: 12, padding: "16px 18px", textAlign: "left", boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}>
              <div style={{ background: "var(--accent-2-bg)", borderRadius: 10, padding: 10, display: "flex" }}>
                <Icon size={20} color="var(--accent-1)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{t.label}</div>
                <div style={{ fontSize: 12, color: "#8A93A0" }}>{t.desc}</div>
              </div>
              <ChevronRight size={18} color="#C7CDD5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
