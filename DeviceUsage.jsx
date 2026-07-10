import React, { useState, useEffect, useMemo } from "react";
import { Cpu, ChevronRight, ArrowLeft } from "lucide-react";
import { supabase } from "./supabaseClient";

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);

export default function DeviceUsage() {
  const [devices, setDevices] = useState(null);
  const [reagents, setReagents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selected, setSelected] = useState(null);

  async function loadAll() {
    const { data: d } = await supabase.from("devices").select("*").order("name");
    const { data: r } = await supabase.from("reagents").select("*");
    const { data: l } = await supabase.from("consumption_logs").select("*");
    setDevices(d || []);
    setReagents(r || []);
    setLogs(l || []);
  }
  useEffect(() => { loadAll(); }, []);

  // Reagent lots that have ever been assigned to a device, grouped by device name
  // (covers devices not in the `devices` table too, in case someone typed a
  // free-text device name when receiving stock).
  const deviceNames = useMemo(() => {
    const fromTable = (devices || []).map((d) => d.name);
    const fromReagents = [...new Set(reagents.map((r) => r.device).filter(Boolean))];
    return [...new Set([...fromTable, ...fromReagents])];
  }, [devices, reagents]);

  if (devices === null) return <div style={{ padding: 40, textAlign: "center", color: "#8A9694" }}>Loading…</div>;

  if (selected) {
    return <DeviceDetail deviceName={selected} reagents={reagents} logs={logs} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><Cpu size={20} /> Devices</h2>
      <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 20 }}>Tap a device to see its reagent history and usage averages.</div>

      {deviceNames.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#8A9694", fontSize: 13.5 }}>No devices with reagents assigned yet. Set a device when receiving stock, or add devices in Settings.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {deviceNames.map((name) => {
            const lots = reagents.filter((r) => r.device === name && !r.deleted);
            return (
              <button key={name} onClick={() => setSelected(name)} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: "14px 16px", textAlign: "left" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{name}</div>
                  <div style={{ fontSize: 12, color: "#8A9694" }}>{lots.length} reagent lot(s) currently assigned</div>
                </div>
                <ChevronRight size={16} color="#B7C3C0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeviceDetail({ deviceName, reagents, logs, onBack }) {
  const lots = useMemo(() => reagents.filter((r) => r.device === deviceName).sort((a, b) => new Date(b.date_added) - new Date(a.date_added)), [reagents, deviceName]);
  const lotIds = new Set(lots.map((l) => l.id));
  const deviceLogs = useMemo(() => logs.filter((l) => lotIds.has(l.reagent_id) && !l.deleted), [logs, lotIds]);

  // By reagent name, grouped installation history: each new lot = a "reagent change" event.
  const byName = useMemo(() => {
    const map = {};
    lots.forEach((l) => {
      if (!map[l.name]) map[l.name] = [];
      map[l.name].push(l);
    });
    return map;
  }, [lots]);

  const today = todayISO();
  const last30 = deviceLogs.filter((l) => daysBetween(today, l.date) <= 30);
  const total30 = last30.reduce((s, l) => s + l.amount, 0);
  const dailyAvg = total30 / 30;
  const weeklyAvg = dailyAvg * 7;
  const monthlyAvg = dailyAvg * 30;

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#0F7173", fontSize: 13, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 4 }}><ArrowLeft size={14} /> Back to devices</button>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{deviceName}</h2>
      <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 20 }}>Usage averages are based on the last 30 days of logged consumption.</div>

      <div style={{ display: "flex", gap: 12, marginBottom: 26, flexWrap: "wrap" }}>
        <StatBox label="Daily avg use" value={dailyAvg.toFixed(1)} />
        <StatBox label="Weekly avg use" value={weeklyAvg.toFixed(1)} />
        <StatBox label="Monthly avg use" value={monthlyAvg.toFixed(1)} />
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, letterSpacing: 0.3 }}>REAGENT INSTALLATION HISTORY</div>
      {Object.keys(byName).length === 0 ? (
        <div style={{ fontSize: 13, color: "#8A9694", marginBottom: 20 }}>No reagents have been assigned to this device yet.</div>
      ) : (
        Object.entries(byName).map(([name, items]) => (
          <div key={name} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{name}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((it) => (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #E1E8E5", borderRadius: 8, padding: "9px 14px", fontSize: 13 }}>
                  <div style={{ width: 100, color: "#8A9694", fontFamily: "'IBM Plex Mono', monospace" }}>{it.date_added}</div>
                  <div style={{ flex: 1, fontFamily: "'IBM Plex Mono', monospace" }}>Lot {it.lot_number}</div>
                  <div>{it.current_quantity}/{it.quantity_received} {it.unit}</div>
                  <div style={{ color: it.deleted ? "#C1432B" : "#2F6B4F", fontSize: 11.5, fontWeight: 700 }}>{it.deleted ? "removed" : "active"}</div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: "14px 16px", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: 12.5, color: "#7B8E8A" }}>{label}</div>
    </div>
  );
}
