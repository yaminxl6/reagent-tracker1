import React from "react";
import { LayoutGrid, Refrigerator, Cpu, ChevronRight } from "lucide-react";

export default function Home({ counts, onNavigate }) {
  const tiles = [
    { key: "stock", label: "Reagents & Stock", desc: "Inventory, expiry, and consumption", icon: LayoutGrid, badge: counts.red > 0 ? `${counts.red} critical` : null },
    { key: "fridges", label: "Fridges", desc: "Monthly fridge & equipment counts", icon: Refrigerator },
    { key: "devices", label: "Devices", desc: "Reagent history & usage per device", icon: Cpu },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Reagent Log</h2>
      <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 22 }}>Where do you want to go?</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => onNavigate(t.key)} style={{ display: "flex", alignItems: "center", gap: 16, background: "#fff", border: "1px solid #EDEFF2", borderRadius: 12, padding: "18px 18px", textAlign: "left", boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}>
              <div style={{ background: "var(--accent-2-bg)", borderRadius: 10, padding: 10, display: "flex" }}>
                <Icon size={22} color="var(--accent-1)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{t.label}</div>
                <div style={{ fontSize: 12.5, color: "#8A9694" }}>{t.desc}</div>
              </div>
              {t.badge && <span style={{ background: "#FBEAE6", color: "#C1432B", fontSize: 11, fontWeight: 700, padding: "4px 9px", borderRadius: 6 }}>{t.badge}</span>}
              <ChevronRight size={18} color="#B7C3C0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
