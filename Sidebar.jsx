import React from "react";
import { LayoutGrid, FileText, Refrigerator, Cpu, SlidersHorizontal, BarChart3, History, Home as HomeIcon, Beaker, X } from "lucide-react";

const NAV_ITEMS = [
  { key: "home", label: "Home", icon: HomeIcon },
  { key: "stock", label: "Stock", icon: LayoutGrid, alsoActive: "detail" },
  { key: "fridges", label: "Fridges", icon: Refrigerator },
  { key: "devices", label: "Devices", icon: Cpu },
  { key: "reports", label: "Reports", icon: FileText },
  { key: "charts", label: "Charts", icon: BarChart3, minRole: ["admin", "super", "owner"] },
  { key: "settings", label: "Settings", icon: SlidersHorizontal, minRole: ["admin", "super", "owner"] },
  { key: "deletions", label: "Activity", icon: History, minRole: ["super", "owner"] },
];

export default function Sidebar({ tab, setTab, role, open, onClose }) {
  const items = NAV_ITEMS.filter((i) => !i.minRole || i.minRole.includes(role));
  return (
    <>
      {open && <div className="no-print" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 39, display: window.innerWidth < 900 ? "block" : "none" }} />}
      <aside className="no-print" style={{
        position: window.innerWidth < 900 ? "fixed" : "sticky",
        top: 0, left: open || window.innerWidth >= 900 ? 0 : -240,
        height: "100vh", width: 220, background: "var(--header-bg)",
        transition: "left .2s", zIndex: 40, display: "flex", flexDirection: "column", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 16px", borderBottom: "1px solid #39494A" }}>
          <Beaker size={22} color="#5FD9C7" />
          <div>
            <div style={{ color: "#F0F3F2", fontWeight: 700, fontSize: 15 }}>Reagent Log</div>
            <div style={{ color: "#8FA39E", fontSize: 10.5, fontFamily: "'IBM Plex Mono', monospace" }}>Rabia Hospital</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "#8FA39E", display: window.innerWidth < 900 ? "flex" : "none" }}><X size={18} /></button>
        </div>
        <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 3, overflowY: "auto" }}>
          {items.map((it) => {
            const Icon = it.icon;
            const active = tab === it.key || tab === it.alsoActive;
            return (
              <button
                key={it.key}
                onClick={() => { setTab(it.key); onClose(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, background: active ? "rgba(95,217,199,0.14)" : "transparent",
                  color: active ? "#5FD9C7" : "#B7C3C0", border: "none", borderRadius: 8, padding: "10px 12px",
                  fontSize: 13.5, fontWeight: active ? 700 : 500, textAlign: "left", cursor: "pointer",
                }}
              >
                <Icon size={16} /> {it.label}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
