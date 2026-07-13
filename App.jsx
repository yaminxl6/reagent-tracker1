import React, { useState, useEffect, useMemo } from "react";
import { Beaker, TrendingDown, Plus, Users as UsersIcon, FileText, LayoutGrid, ChevronRight, X, Droplet, ScanLine, Pencil, Trash2, Bell, LogOut, SlidersHorizontal, Download, AlertTriangle, ClipboardX, History, BarChart3, Printer, Upload, Refrigerator, Home as Home2, Cpu, Menu as MenuIcon, CheckCircle2, Clock, Truck, Package, ClipboardList } from "lucide-react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import Settings from "./Settings";
import BarcodeScanner from "./BarcodeScanner";
import ReceiveWizard, { YesNoRow } from "./ReceiveWizard";
import Charts from "./Charts";
import ReagentImport from "./ReagentImport";
import FridgeInventory from "./FridgeInventory";
import SearchableSelect from "./SearchableSelect";
import Home from "./Home";
import DeviceUsage from "./DeviceUsage";
import Batches from "./Batches";
import Suppliers from "./Suppliers";
import Users from "./Users";
import OrderPlan from "./OrderPlan";

const DEPT_PALETTE = ["#0F7173", "#B5473A", "#8A5A2B", "#5A6ACF", "#2F8F5B", "#B8860B", "#7A4FA3", "#C1432B"];
// Your lab's fridges, always offered on Receive even before any data exists
// for them. "Room Temperature" is a pseudo-fridge for stock that doesn't
// need refrigeration (kept in the regular storeroom instead).
const BASE_FRIDGES = ["R011", "R014", "R009", "R01", "Lab0202", "R012", "R0008"];
const ROOM_TEMP = "Room Temperature (Warehouse)";
function deptColor(dept, list) {
  const i = Math.max(0, list.indexOf(dept));
  return DEPT_PALETTE[i % DEPT_PALETTE.length];
}
const INSPECTION_KEYS = ["intact_container", "complete_compound", "expiration_validity", "lot_matches_kit", "storage_condition_ok"];
const ENTITY_LABELS = { reagent: "Reagent lot", log: "Usage log", config: "Settings", preset: "Preset", device: "Device", staff: "Employee account", department: "Department", fridge: "Fridge/equipment count" };

const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString() : "");

function statusOf(item, expiryWarningDays) {
  const dExp = daysBetween(item.expiry_date, todayISO());
  const lowStock = item.current_quantity <= item.low_stock_threshold;
  if (dExp < 0 || item.current_quantity <= 0) return "red";
  if (dExp <= (expiryWarningDays ?? 30) || lowStock) return "yellow";
  return "green";
}

function hasInspectionIssue(item) {
  return INSPECTION_KEYS.some((k) => item[k] === false);
}

const STATUS_META = {
  red: { label: "Critical", color: "#C1432B", bg: "#FBEAE6" },
  yellow: { label: "Watch", color: "#B8860B", bg: "#FBF3DF" },
  green: { label: "Stable", color: "#2F6B4F", bg: "#E8F2EC" },
};

export default function App() {
  const [config, setConfig] = useState(null);
  const [role, setRole] = useState(() => localStorage.getItem("reagent_role") || null);
  const [username, setUsername] = useState(() => localStorage.getItem("reagent_username") || "");
  const [reagents, setReagents] = useState(null);
  const [logs, setLogs] = useState(null);
  const [presets, setPresets] = useState([]);
  const [staffAccounts, setStaffAccounts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [fridgeNames, setFridgeNames] = useState([]);
  const [fridgeTempLogs, setFridgeTempLogs] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [tab, setTab] = useState("home");
  const [showWizard, setShowWizard] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [editReagent, setEditReagent] = useState(null);
  const [editLog, setEditLog] = useState(null);
  const [error, setError] = useState("");
  const [bannerDismissed, setBannerDismissed] = useState(false);

  async function ensureConfig() {
    let { data } = await supabase.from("app_config").select("*").eq("id", 1).maybeSingle();
    if (!data) {
      await supabase.from("app_config").insert({ id: 1 });
      const r = await supabase.from("app_config").select("*").eq("id", 1).maybeSingle();
      data = r.data;
    }
    setConfig(data);
  }

  async function fetchAll(table, orderCol, ascending = true) {
    const pageSize = 1000;
    // Find out how many rows there are first, then fetch every page in
    // parallel instead of one-at-a-time — much faster for large tables.
    const { count, error: countErr } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (countErr) throw countErr;
    const total = count || 0;
    if (total === 0) return [];
    const pageStarts = [];
    for (let from = 0; from < total; from += pageSize) pageStarts.push(from);
    const pages = await Promise.all(
      pageStarts.map(async (from) => {
        let query = supabase.from(table).select("*").range(from, from + pageSize - 1);
        if (orderCol) query = query.order(orderCol, { ascending });
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      })
    );
    return pages.flat();
  }

  async function loadAll() {
    let r, l;
    try {
      [r, l] = await Promise.all([
        fetchAll("reagents", "expiry_date"),
        fetchAll("consumption_logs"),
      ]);
    } catch (err) {
      setError("Could not connect to the database. Check Supabase settings.");
      setReagents([]);
      setLogs([]);
      return;
    }
    const [{ data: p }, { data: s }, { data: a }, { data: dv }, supRes, fridgeRes, tempRes] = await Promise.all([
      supabase.from("reagent_presets").select("*").order("name"),
      supabase.from("staff_accounts").select("*").order("username"),
      supabase.from("audit_log").select("*").order("performed_at", { ascending: false }),
      supabase.from("devices").select("*").order("name"),
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("fridge_inventory").select("refrigerator_name"),
      supabase.from("fridge_temperature_logs").select("*").order("date", { ascending: false }),
    ]);
    setReagents(r || []);
    setLogs(l || []);
    setPresets(p || []);
    setStaffAccounts(s || []);
    setActivityLog(a || []);
    setDevices(dv || []);
    setSuppliers(supRes?.data || []);
    const namesFromFridgeSheet = (fridgeRes?.data || []).map((f) => f.refrigerator_name);
    const namesFromReagents = (r || []).map((x) => x.fridge_name).filter(Boolean);
    const allNames = [...new Set([...BASE_FRIDGES, ...namesFromFridgeSheet, ...namesFromReagents])].sort();
    setFridgeNames([ROOM_TEMP, ...allNames]);
    setFridgeTempLogs(tempRes?.data || []);
  }

  async function logActivity(action, entity, description) {
    await supabase.from("audit_log").insert({ action, entity, description, performed_by: username });
  }

  useEffect(() => {
    ensureConfig();
    loadAll();
  }, []);

  function handleLogin(newRole, newUsername) {
    localStorage.setItem("reagent_role", newRole);
    localStorage.setItem("reagent_username", newUsername);
    setRole(newRole);
    setUsername(newUsername);
  }
  function logout() {
    localStorage.removeItem("reagent_role");
    localStorage.removeItem("reagent_username");
    setRole(null);
    setUsername("");
  }

  async function addReagent(entry) {
    const dup = reagents.find((r) => !r.deleted && r.name === entry.name && r.lot_number === entry.lotNumber);
    if (dup && !confirm(`Lot ${entry.lotNumber} already exists for ${entry.name}. Add it again anyway?`)) return;
    await supabase.from("reagents").insert({
      name: entry.name,
      department: entry.department,
      item_type: entry.itemType,
      device: entry.device || "",
      fridge_name: entry.fridgeName || "",
      lot_number: entry.lotNumber,
      unit: entry.unit,
      quantity_received: entry.quantityReceived,
      current_quantity: entry.quantityReceived,
      expiry_date: entry.expiryDate,
      date_added: entry.receivedDate,
      added_by: entry.receivedBy,
      low_stock_threshold: entry.lowStockThreshold,
      intact_container: entry.intact_container,
      complete_compound: entry.complete_compound,
      expiration_validity: entry.expiration_validity,
      lot_matches_kit: entry.lot_matches_kit,
      storage_condition_ok: entry.storage_condition_ok,
      receiving_notes: entry.receivingNotes,
      inspection_notes: entry.inspectionNotes,
    });
    await logActivity("receive", "reagent", `${entry.name} — Lot ${entry.lotNumber}, ${entry.quantityReceived} ${entry.unit}, received by ${entry.receivedBy}`);
    setShowWizard(false);
    loadAll();
  }

  async function bulkReceive(rows) {
    for (const entry of rows) {
      await supabase.from("reagents").insert({
        name: entry.name,
        department: entry.department,
        item_type: entry.itemType || "Reagent",
        device: entry.device || "",
        fridge_name: entry.fridgeName || "",
        lot_number: entry.lotNumber,
        unit: entry.unit || "unit",
        quantity_received: Number(entry.quantityReceived),
        current_quantity: Number(entry.quantityReceived),
        expiry_date: entry.expiryDate,
        date_added: entry.receivedDate,
        added_by: entry.receivedBy,
        low_stock_threshold: Number(entry.lowStockThreshold) || Math.ceil(Number(entry.quantityReceived) * ((config.low_stock_default_percent || 15) / 100)),
        intact_container: true, complete_compound: true, expiration_validity: true, lot_matches_kit: true, storage_condition_ok: true,
      });
    }
    await logActivity("bulk_import", "reagent", `Imported ${rows.length} lot(s) from file`);
    setShowImport(false);
    loadAll();
  }

  async function recordConsumption(entry) {
    const item = reagents.find((r) => r.id === entry.reagentId);
    if (!item) return;
    const newQty = Math.max(0, item.current_quantity - entry.amount);
    await supabase.from("reagents").update({ current_quantity: newQty }).eq("id", item.id);
    await supabase.from("consumption_logs").insert({
      reagent_id: entry.reagentId, amount: entry.amount, date: entry.date, used_by: entry.usedBy, note: entry.note, tested_by_qc: entry.testedByQC,
    });
    await logActivity("log_use", "log", `${item.name} — −${entry.amount} ${item.unit} used by ${entry.usedBy}${entry.note ? ` (${entry.note})` : ""}`);
    setShowLog(false);
    loadAll();
  }

  async function saveEditedReagent(updated) {
    await supabase.from("reagents").update({
      lot_number: updated.lot_number,
      quantity_received: updated.quantity_received,
      current_quantity: updated.current_quantity,
      expiry_date: updated.expiry_date,
      low_stock_threshold: updated.low_stock_threshold,
      edited_by: username,
      edited_at: new Date().toISOString(),
    }).eq("id", updated.id);
    await logActivity("edit", "reagent", `${updated.name || ""} — Lot ${updated.lot_number}`.trim());
    setEditReagent(null);
    loadAll();
  }

  async function deleteReagent(id) {
    if (!["admin","super","owner"].includes(role)) return;
    if (!confirm("Remove this lot from the active inventory? It will stay in Reports for audit purposes.")) return;
    const item = reagents.find((r) => r.id === id);
    await supabase.from("reagents").update({ deleted: true, deleted_by: username, deleted_at: new Date().toISOString() }).eq("id", id);
    await logActivity("delete", "reagent", item ? `${item.name} — Lot ${item.lot_number}` : id);
    loadAll();
  }

  async function saveEditedLog(updated, original) {
    const item = reagents.find((r) => r.id === original.reagent_id);
    if (item) {
      const delta = updated.amount - original.amount;
      const newQty = Math.max(0, item.current_quantity - delta);
      await supabase.from("reagents").update({ current_quantity: newQty }).eq("id", item.id);
    }
    await supabase.from("consumption_logs").update({
      amount: updated.amount, date: updated.date, used_by: updated.used_by, note: updated.note, tested_by_qc: updated.tested_by_qc,
      edited_by: username, edited_at: new Date().toISOString(),
    }).eq("id", updated.id);
    await logActivity("edit", "log", `${item ? item.name : "Unknown"} — ${updated.amount} used by ${updated.used_by} on ${updated.date}`);
    setEditLog(null);
    loadAll();
  }

  async function deleteLog(log) {
    if (!["admin","super","owner"].includes(role)) return;
    if (!confirm("Remove this log entry? The amount will be added back to stock, but it stays in Reports for audit purposes.")) return;
    const item = reagents.find((r) => r.id === log.reagent_id);
    if (item) await supabase.from("reagents").update({ current_quantity: item.current_quantity + log.amount }).eq("id", item.id);
    await supabase.from("consumption_logs").update({ deleted: true, deleted_by: username, deleted_at: new Date().toISOString() }).eq("id", log.id);
    await logActivity("delete", "log", `${item ? item.name : "Unknown"} — ${log.amount} used by ${log.used_by} on ${log.date}`);
    loadAll();
  }

  async function purgeReagent(id) {
    if (role !== "super") return;
    if (!confirm("Permanently erase this record? This cannot be undone and it will disappear from Reports too.")) return;
    const item = reagents.find((r) => r.id === id);
    await supabase.from("reagents").delete().eq("id", id);
    await logActivity("purge", "reagent", item ? `${item.name} — Lot ${item.lot_number}` : id);
    loadAll();
  }

  async function purgeLog(id) {
    if (role !== "super") return;
    if (!confirm("Permanently erase this record? This cannot be undone and it will disappear from Reports too.")) return;
    const log = logs.find((l) => l.id === id);
    const item = log ? reagents.find((r) => r.id === log.reagent_id) : null;
    await supabase.from("consumption_logs").delete().eq("id", id);
    await logActivity("purge", "log", log ? `${item ? item.name : "Unknown"} — ${log.amount} used by ${log.used_by} on ${log.date}` : id);
    loadAll();
  }

  async function clearActivityLog() {
    if (role !== "super") return;
    if (!confirm("Erase the entire activity history? This cannot be undone.")) return;
    await supabase.from("audit_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    loadAll();
  }

  const groups = useMemo(() => {
    if (!reagents) return [];
    const active = reagents.filter((r) => !r.deleted);
    const map = {};
    for (const r of active) {
      if (!map[r.name]) map[r.name] = [];
      map[r.name].push(r);
    }
    return Object.entries(map).map(([name, items]) => {
      const sorted = [...items].sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
      const totalQty = items.reduce((s, i) => s + i.current_quantity, 0);
      const worstStatus = items.some((i) => statusOf(i, config?.expiry_warning_days) === "red") ? "red" : items.some((i) => statusOf(i, config?.expiry_warning_days) === "yellow") ? "yellow" : "green";
      const flagged = items.some(hasInspectionIssue);
      return { name, items: sorted, fefo: sorted[0], totalQty, status: worstStatus, department: items[0].department, unit: items[0].unit, flagged };
    });
  }, [reagents, config?.expiry_warning_days]);

  // Auto-archiving: a lot that expired more than 30 days ago drops out of
  // the day-to-day views (Stock, Fridges, Devices) automatically, but is
  // never deleted — it always stays fully visible in Reports.
  const ARCHIVE_GRACE_DAYS = 30;
  function isArchivedLot(r) {
    return daysBetween(r.expiry_date, todayISO()) <= -ARCHIVE_GRACE_DAYS;
  }
  const activeGroups = useMemo(() => {
    return groups
      .map((g) => {
        const liveItems = g.items.filter((r) => !isArchivedLot(r));
        if (liveItems.length === 0) return null;
        const totalQty = liveItems.reduce((s, i) => s + i.current_quantity, 0);
        const worstStatus = liveItems.some((i) => statusOf(i, config?.expiry_warning_days) === "red") ? "red" : liveItems.some((i) => statusOf(i, config?.expiry_warning_days) === "yellow") ? "yellow" : "green";
        const flagged = liveItems.some(hasInspectionIssue);
        return { ...g, items: liveItems, fefo: liveItems[0], totalQty, status: worstStatus, flagged };
      })
      .filter(Boolean);
  }, [groups, config?.expiry_warning_days]);

  const counts = useMemo(() => {
    const c = { red: 0, yellow: 0, green: 0, flagged: 0 };
    activeGroups.forEach((g) => { c[g.status]++; if (g.flagged) c.flagged++; });
    return c;
  }, [activeGroups]);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (!reagents || Notification.permission !== "granted") return;
    if (counts.red === 0) return;
    const key = `notified-${todayISO()}`;
    if (localStorage.getItem(key)) return;
    try {
      new Notification("Reagent Log — Critical items", { body: `${counts.red} reagent(s) expired or out of stock. Open the app to review.` });
      localStorage.setItem(key, "1");
    } catch (err) {
      // Some mobile browsers (e.g. Chrome/Edge on Android once a service
      // worker is registered) refuse `new Notification()` directly and
      // require ServiceWorkerRegistration.showNotification() instead.
      // Skip silently rather than crash the app over a "nice to have".
      localStorage.setItem(key, "1");
    }
  }, [counts, reagents]);

  function enableNotifications() {
    if (typeof Notification === "undefined") {
      alert("Browser notifications aren't supported in this browser (common in in-app browsers like WhatsApp's — try opening the link in Chrome or Safari instead).");
      return;
    }
    try {
      Notification.requestPermission();
    } catch (err) {
      alert("This browser doesn't allow enabling notifications this way. Try opening the site in a regular browser tab (not an installed/PWA version).");
    }
  }

  if (!config || reagents === null || logs === null) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "IBM Plex Mono, monospace", color: "#4A5A5C" }}>Loading…</div>;
  }
  if (!role) return <Login config={config} staffAccounts={staffAccounts} onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: "100vh", background: "#F0F3F2", fontFamily: "'IBM Plex Sans', sans-serif", color: "#1B2B2E" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        button { font-family: inherit; cursor: pointer; }
        input, select { font-family: inherit; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: #C7D1CE; border-radius: 4px; }
        :root {
          --header-bg: linear-gradient(135deg, ${config.theme_colors?.headerStart || "#2563EB"} 0%, ${config.theme_colors?.headerEnd || "#0EA5A5"} 100%);
          --accent-1: ${config.theme_colors?.accent1 || "#2563EB"};      /* primary actions: receive, save, add */
          --accent-1-dark: #1E56C7;
          --accent-2: ${config.theme_colors?.accent2 || "#0EA5A5"};      /* secondary actions: export, import, nav */
          --accent-2-bg: #EAF1FE;
          --accent-3: #D8862B;      /* tertiary highlight: charts, special badges */
          --accent-3-bg: #FBF0E2;
        }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
        .app-layout { display: flex; min-height: 100vh; background: #F8FAFC; font-family: 'Inter', -apple-system, sans-serif; }
        .dash-card { transition: all 0.25s ease; }
        .dash-card:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(0,0,0,0.08) !important; }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .dash-animate { animation: fadeSlideUp 0.4s ease both; }
        .app-sidebar { width: 230px; flex-shrink: 0; background: #fff; border-right: 1px solid #EDEFF2; display: flex; flex-direction: column; }
        .app-main-col { flex: 1; min-width: 0; }
        .mobile-topbar { display: none; }
        @media (max-width: 860px) {
          .app-sidebar {
            position: fixed; top: 0; left: 0; height: 100vh; z-index: 60;
            transform: translateX(-100%); transition: transform .22s ease; overflow-y: auto;
          }
          .app-sidebar.open { transform: translateX(0); box-shadow: 4px 0 24px rgba(0,0,0,0.3); }
          .sidebar-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 55; }
          .mobile-topbar { display: flex; }
        }
      `}</style>

      <div className="app-layout">
        {sidebarOpen && <div className="sidebar-backdrop no-print" onClick={() => setSidebarOpen(false)} />}
        <Sidebar
          className={sidebarOpen ? "app-sidebar open" : "app-sidebar"}
          tab={tab} setTab={(t) => { setTab(t); setSidebarOpen(false); }} role={role}
          appName={config.app_name} appNameColor={config.app_name_color}
          onAdd={() => { setShowWizard(true); setSidebarOpen(false); }}
          onImport={() => { setShowImport(true); setSidebarOpen(false); }}
          onLog={() => { setShowLog(true); setSidebarOpen(false); }}
          onLogout={logout} onEnableNotif={enableNotifications}
        />

        <div className="app-main-col">
          <div className="mobile-topbar no-print" style={{ background: "#fff", borderBottom: "1px solid #EDEFF2", padding: "12px 16px", alignItems: "center", gap: 10 }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background: "transparent", border: "1px solid #E1E5EA", color: "#3B4450", borderRadius: 7, padding: "7px 9px", display: "flex" }}><MenuIcon size={16} /></button>
            <div style={{ color: config.app_name_color || "#1B2328", fontWeight: 700, fontSize: 15 }}>{config.app_name || "Reagent Log"}</div>
          </div>

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 20px 80px" }}>
        {counts.red > 0 && !bannerDismissed && tab !== "settings" && (
          <div className="no-print" style={{ background: "#FBEAE6", border: "1px solid #C1432B33", borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={18} color="#C1432B" />
            <div style={{ flex: 1, fontSize: 13.5, color: "#8A2E1F" }}><b>{counts.red}</b> reagent{counts.red > 1 ? "s" : ""} expired or out of stock — needs attention now.</div>
            <button onClick={() => setBannerDismissed(true)} style={{ background: "none", border: "none", color: "#8A2E1F" }}><X size={16} /></button>
          </div>
        )}
        {counts.flagged > 0 && tab !== "settings" && (
          <div className="no-print" style={{ background: "#FBF3DF", border: "1px solid #B8860B33", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <ClipboardX size={18} color="#B8860B" />
            <div style={{ flex: 1, fontSize: 13.5, color: "#7A5C08" }}><b>{counts.flagged}</b> reagent{counts.flagged > 1 ? "s" : ""} failed an inspection check on receipt — review before use.</div>
          </div>
        )}

        {tab === "home" && <Home counts={counts} groups={activeGroups} reagents={reagents} logs={logs} devices={devices} username={username} role={role} onNavigate={setTab} onSelectGroup={(g) => { setSelectedGroup(g); setTab("detail"); }} />}
        {tab === "stock" && <Dashboard groups={activeGroups} allNames={[...new Set(groups.map((g) => g.name))]} counts={counts} departments={config.departments || []} role={role} onDeleteReagent={deleteReagent} onSelect={(g) => { setSelectedGroup(g); setTab("detail"); }} />}
        {tab === "devices" && <DeviceUsage />}
        {tab === "orderplan" && <OrderPlan reagents={reagents} devices={devices} logActivity={logActivity} />}
        {tab === "batches" && <Batches reagents={reagents} departments={config.departments || []} />}
        {tab === "suppliers" && (["admin","super","owner"].includes(role)) && <Suppliers suppliers={suppliers} reload={loadAll} logActivity={logActivity} canEdit={["admin","super","owner"].includes(role)} />}
        {tab === "users" && (["admin","super","owner"].includes(role)) && <Users staffAccounts={staffAccounts} role={role} logActivity={logActivity} reload={loadAll} />}
        {tab === "detail" && selectedGroup && (
          <DetailView
            group={groups.find((g) => g.name === selectedGroup.name) || selectedGroup}
            logs={logs.filter((l) => !l.deleted && (groups.find((g) => g.name === selectedGroup.name)?.items || []).some((i) => i.id === l.reagent_id))}
            role={role}
            expiryWarningDays={config?.expiry_warning_days}
            onBack={() => setTab("stock")}
            onEditReagent={setEditReagent} onDeleteReagent={deleteReagent}
            onEditLog={setEditLog} onDeleteLog={deleteLog}
          />
        )}
        {tab === "reports" && <Reports reagents={reagents} logs={logs} fridgeTempLogs={fridgeTempLogs} departments={config.departments || []} role={role} onPurgeReagent={purgeReagent} onPurgeLog={purgeLog} />}
        {tab === "settings" && (["admin","super","owner"].includes(role)) && <Settings config={config} presets={presets} role={role} staffAccounts={staffAccounts} devices={devices} fridgeNames={fridgeNames} reagents={reagents} logs={logs} logActivity={logActivity} reload={() => { ensureConfig(); loadAll(); }} />}
        {tab === "fridges" && <FridgeInventory username={username} logActivity={logActivity} />}
        {tab === "charts" && (["admin","super","owner"].includes(role)) && <Charts reagents={reagents} logs={logs} />}
        {tab === "deletions" && ["super","owner"].includes(role) && <DeletionsLog activityLog={activityLog} onClear={clearActivityLog} />}
      </main>
        </div>
      </div>

      {showWizard && <ReceiveWizard presets={presets} devices={devices} fridgeNames={fridgeNames} role={role} departments={config.departments || []} onClose={() => setShowWizard(false)} onSubmit={addReagent} />}
      {showImport && (
        <Modal title="Bulk import reagents" onClose={() => setShowImport(false)}>
          <ReagentImport departments={config.departments || []} onApply={bulkReceive} />
        </Modal>
      )}
      {showLog && <LogConsumptionModal reagents={reagents.filter((r) => !r.deleted)} onClose={() => setShowLog(false)} onSubmit={recordConsumption} />}
      {editReagent && <EditReagentModal reagent={editReagent} onClose={() => setEditReagent(null)} onSave={saveEditedReagent} />}
      {editLog && <EditLogModal log={editLog} onClose={() => setEditLog(null)} onSave={saveEditedLog} />}
      {error && <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "#C1432B", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 14 }}>{error}</div>}
    </div>
  );
}

function Sidebar({ className, tab, setTab, role, appName, appNameColor, onAdd, onImport, onLog, onLogout, onEnableNotif }) {
  const isAdmin = ["admin","super","owner"].includes(role);
  const isSuper = ["super","owner"].includes(role);
  return (
    <aside className={className}>
      <div style={{ padding: "20px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #EDEFF2" }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--accent-2-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Beaker size={19} color="var(--accent-1)" />
        </div>
        <div>
          <div style={{ color: appNameColor || "#1B2328", fontWeight: 700, fontSize: 15.5, letterSpacing: 0.1 }}>{appName || "Reagent Log"}</div>
          <div style={{ color: "#8A93A0", fontSize: 11 }}>Rabia Hospital</div>
        </div>
      </div>

      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "14px 12px", overflowY: "auto" }}>
        <SideBtn active={tab === "home"} onClick={() => setTab("home")} icon={<Home2 size={16} />} label="Home" />

        <SideGroupLabel>Inventory</SideGroupLabel>
        <SideBtn active={tab === "stock" || tab === "detail"} onClick={() => setTab("stock")} icon={<LayoutGrid size={16} />} label="Stock" />
        <SideBtn active={tab === "batches"} onClick={() => setTab("batches")} icon={<Package size={16} />} label="Batches" />
        <SideBtn active={tab === "fridges"} onClick={() => setTab("fridges")} icon={<Refrigerator size={16} />} label="Fridges" />
        <SideBtn active={tab === "devices"} onClick={() => setTab("devices")} icon={<Cpu size={16} />} label="Devices" />
        <SideBtn active={tab === "orderplan"} onClick={() => setTab("orderplan")} icon={<ClipboardList size={16} />} label="Order Plan" />

        <SideGroupLabel>Tracking</SideGroupLabel>
        <SideBtn active={tab === "reports"} onClick={() => setTab("reports")} icon={<FileText size={16} />} label="Reports" />
        {isAdmin && <SideBtn active={tab === "charts"} onClick={() => setTab("charts")} icon={<BarChart3 size={16} />} label="Charts" />}
        {isSuper && <SideBtn active={tab === "deletions"} onClick={() => setTab("deletions")} icon={<History size={16} />} label="Activity" />}

        {isAdmin && (
          <>
            <SideGroupLabel>Management</SideGroupLabel>
            <SideBtn active={tab === "suppliers"} onClick={() => setTab("suppliers")} icon={<Truck size={16} />} label="Suppliers" />
            <SideBtn active={tab === "users"} onClick={() => setTab("users")} icon={<UsersIcon size={16} />} label="Users" />
            <SideBtn active={tab === "settings"} onClick={() => setTab("settings")} icon={<SlidersHorizontal size={16} />} label="Settings" />
          </>
        )}

        <div style={{ height: 1, background: "#EDEFF2", margin: "14px 4px" }} />

        <button onClick={onAdd} style={{ background: "var(--accent-1)", border: "none", color: "#fff", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, margin: "3px 4px", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}><Plus size={14} /> Receive stock</button>
        <button onClick={onLog} style={{ background: "#fff", border: "1px solid #E1E5EA", color: "#3B4450", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, margin: "3px 4px" }}><TrendingDown size={14} /> Log use</button>
        <button onClick={onImport} style={{ background: "#fff", border: "1px solid #E1E5EA", color: "#3B4450", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, margin: "3px 4px" }}><Upload size={14} /> Bulk import</button>
      </nav>

      <div style={{ padding: "12px 12px", borderTop: "1px solid #EDEFF2", display: "flex", gap: 8 }}>
        <button onClick={onEnableNotif} title="Enable browser alerts" style={{ flex: 1, background: "#fff", border: "1px solid #E1E5EA", color: "#8A93A0", borderRadius: 8, padding: "8px", display: "flex", justifyContent: "center" }}><Bell size={14} /></button>
        <button onClick={onLogout} title="Log out" style={{ flex: 1, background: "#fff", border: "1px solid #E1E5EA", color: "#8A93A0", borderRadius: 8, padding: "8px", display: "flex", justifyContent: "center" }}><LogOut size={14} /></button>
      </div>
    </aside>
  );
}

function SideGroupLabel({ children }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, color: "#A6ADB8", textTransform: "uppercase", letterSpacing: 0.6, padding: "14px 12px 6px" }}>{children}</div>;
}

function SideBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} style={{ background: active ? "var(--accent-2-bg)" : "transparent", color: active ? "var(--accent-1)" : "#5C6570", border: "none", borderRadius: 8, padding: "9px 12px", fontSize: 13.5, fontWeight: active ? 700 : 600, display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>

      {icon} {label}
    </button>
  );
}



function StatCard({ status, count, label }) {
  const m = STATUS_META[status];
  const Icon = status === "red" ? AlertTriangle : status === "yellow" ? Clock : CheckCircle2;
  return (
    <div style={{ background: "#fff", border: "1px solid #EDEFF2", borderRadius: 12, padding: "16px 18px", flex: 1, minWidth: 150, display: "flex", alignItems: "center", gap: 14, boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: m.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={19} color={m.color} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1B2328" }}>{count}</div>
        <div style={{ fontSize: 12.5, color: "#8A93A0", fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

function GaugeBar({ pct, color }) {
  return (
    <div style={{ width: 44, height: 64, border: "1.5px solid #C7D1CE", borderRadius: 5, position: "relative", overflow: "hidden", background: "#fff", flexShrink: 0 }}>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${Math.min(100, Math.max(3, pct))}%`, background: color, transition: "height .3s" }} />
      <div style={{ position: "absolute", top: 4, left: 0, right: 0, textAlign: "center", fontSize: 9, color: "#8A9694", fontFamily: "'IBM Plex Mono', monospace" }}>{Math.round(pct)}%</div>
    </div>
  );
}

function Dashboard({ groups, allNames, counts, departments, role, onDeleteReagent, onSelect }) {
  const [deptFilter, setDeptFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");

  if (groups.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px", color: "#7B8E8A" }}>
        <Droplet size={36} style={{ marginBottom: 12, opacity: 0.5 }} />
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: "#1B2B2E" }}>No reagents logged yet</div>
        <div style={{ fontSize: 14 }}>Use "Receive stock" above to add your first reagent batch.</div>
      </div>
    );
  }
  const term = itemFilter.trim().toLowerCase();
  const filteredGroups = groups
    .filter((g) => (deptFilter ? g.department === deptFilter : true))
    .filter((g) => (term ? g.name.toLowerCase().includes(term) || g.fefo.lot_number.toLowerCase().includes(term) || (g.fefo.device || "").toLowerCase().includes(term) : true));
  const byDept = departments.map((d) => ({ dept: d, items: filteredGroups.filter((g) => g.department === d) })).filter((x) => x.items.length);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} style={{ border: "1px solid #C7D1CE", borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff", minWidth: 160 }}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <SearchableSelect
          value={itemFilter}
          onChange={setItemFilter}
          options={allNames || []}
          placeholder="Reagent, lot number, or device…"
          style={{ flex: 1, minWidth: 200 }}
        />
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <StatCard status="red" count={counts.red} label="Critical — expired or out" />
        <StatCard status="yellow" count={counts.yellow} label="Watch — expiring or low" />
        <StatCard status="green" count={counts.green} label="Stable" />
      </div>
      {byDept.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#8A9694", fontSize: 13.5 }}>No matches for this filter.</div>
      )}
      {byDept.map(({ dept, items }) => (
        <div key={dept} style={{ marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: deptColor(dept, departments) }} />
            <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.3 }}>{dept}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((g) => {
              const m = STATUS_META[g.status];
              const pct = (g.fefo.current_quantity / g.fefo.quantity_received) * 100;
              const dExp = daysBetween(g.fefo.expiry_date, todayISO());
              return (
                <div key={g.name} onClick={() => onSelect(g)} style={{ display: "flex", alignItems: "center", gap: 16, background: "#fff", border: "1px solid #E1E8E5", borderLeft: `4px solid ${m.color}`, borderRadius: 8, padding: "12px 16px", textAlign: "left", cursor: "pointer" }}>
                  <GaugeBar pct={pct} color={m.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
                      {g.name}
                      {g.flagged && <ClipboardX size={13} color="#B8860B" title="Inspection issue on receipt" />}
                    </div>
                    <div style={{ fontSize: 12.5, color: "#7B8E8A", fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                      Lot {g.fefo.lot_number} · {g.fefo.current_quantity} {g.unit} left · {g.items.length > 1 ? `${g.items.length} lots` : "1 lot"}{g.fefo.device ? ` · ${g.fefo.device}` : ""}{g.fefo.fridge_name ? ` · ${g.fefo.fridge_name}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.label}</div>
                    <div style={{ fontSize: 11.5, color: "#8A9694" }}>{dExp < 0 ? `expired ${Math.abs(dExp)}d ago` : `expires in ${dExp}d`}</div>
                  </div>
                  {(["admin","super","owner"].includes(role)) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteReagent(g.fefo.id); }}
                      title="Remove this lot"
                      style={{ background: "none", border: "none", color: "#C1432B", padding: 4 }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                  <ChevronRight size={16} color="#B7C3C0" />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailView({ group, logs, role, expiryWarningDays, onBack, onEditReagent, onDeleteReagent, onEditLog, onDeleteLog }) {
  const last30 = logs.filter((l) => daysBetween(todayISO(), l.date) <= 30);
  const consumed30 = last30.reduce((s, l) => s + l.amount, 0);
  const avgDaily = consumed30 / 30;
  const daysLeft = avgDaily > 0 ? Math.round(group.totalQty / avgDaily) : null;

  const inspectionLabels = {
    intact_container: "Intact container",
    complete_compound: "Complete components",
    expiration_validity: "Expiration validity",
    lot_matches_kit: "Lot number of kit matches components",
    storage_condition_ok: "Storage condition",
  };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#0F7173", fontSize: 13, fontWeight: 600, marginBottom: 18, display: "flex", alignItems: "center", gap: 4 }}>← Back to dashboard</button>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{group.name}</h2>
      <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 20, fontFamily: "'IBM Plex Mono', monospace" }}>{group.department} · {group.totalQty} {group.unit} in stock across {group.items.length} lot(s)</div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: "14px 16px", flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 11, color: "#8A9694", fontWeight: 600, textTransform: "uppercase" }}>Avg daily use (30d)</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{avgDaily.toFixed(1)} <span style={{ fontSize: 13, fontWeight: 500 }}>{group.unit}/day</span></div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: "14px 16px", flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 11, color: "#8A9694", fontWeight: 600, textTransform: "uppercase" }}>Projected runout</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{daysLeft !== null ? `${daysLeft}d` : "—"}</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: "14px 16px", flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 11, color: "#8A9694", fontWeight: 600, textTransform: "uppercase" }}>Consumed this month</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{consumed30} <span style={{ fontSize: 13, fontWeight: 500 }}>{group.unit}</span></div>
        </div>
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 0.3 }}>LOTS — use earliest expiry first (FEFO)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
        {group.items.map((it, idx) => {
          const dExp = daysBetween(it.expiry_date, todayISO());
          const m = STATUS_META[statusOf(it, expiryWarningDays)];
          const failedItems = INSPECTION_KEYS.filter((k) => it[k] === false).map((k) => inspectionLabels[k]);
          return (
            <div key={it.id} style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {idx === 0 && <span style={{ background: "#0F7173", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 4 }}>USE FIRST</span>}
                <div style={{ flex: 1, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>Lot {it.lot_number}</div>
                <div style={{ fontSize: 13 }}>{it.current_quantity}/{it.quantity_received} {it.unit}</div>
                <div style={{ fontSize: 12.5, color: m.color, fontWeight: 600 }}>{dExp < 0 ? `expired ${Math.abs(dExp)}d ago` : `${dExp}d left`}</div>
                <button onClick={() => onEditReagent(it)} style={{ background: "none", border: "none", color: "#8A9694" }}><Pencil size={14} /></button>
                {(["admin","super","owner"].includes(role)) && <button onClick={() => onDeleteReagent(it.id)} style={{ background: "none", border: "none", color: "#C1432B" }}><Trash2 size={14} /></button>}
              </div>
              {failedItems.length > 0 && (
                <div style={{ marginTop: 8, background: "#FBF3DF", border: "1px solid #B8860B33", borderRadius: 6, padding: "6px 10px", fontSize: 11.5, color: "#7A5C08" }}>
                  ⚠ Inspection issue: {failedItems.join(", ")}
                </div>
              )}
              {(it.receiving_notes || it.inspection_notes) && (
                <div style={{ marginTop: 8, fontSize: 11.5, color: "#516361" }}>
                  {it.receiving_notes && <div><b>Note:</b> {it.receiving_notes}</div>}
                  {it.inspection_notes && <div><b>Inspection note:</b> {it.inspection_notes}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 0.3 }}>CONSUMPTION HISTORY</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {logs.length === 0 && <div style={{ fontSize: 13, color: "#8A9694" }}>No usage logged yet.</div>}
        {[...logs].sort((a, b) => new Date(b.date) - new Date(a.date)).map((l) => (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13, padding: "8px 0", borderBottom: "1px solid #EEF2F0" }}>
            <div style={{ width: 90, color: "#8A9694", fontFamily: "'IBM Plex Mono', monospace" }}>{l.date}</div>
            <div style={{ flex: 1 }}>−{l.amount} {group.unit}</div>
            <div style={{ color: "#7B8E8A", display: "flex", alignItems: "center", gap: 4 }}><UsersIcon size={12} /> {l.used_by}</div>
            <div style={{ fontSize: 11, color: l.tested_by_qc ? "#2F6B4F" : "#8A9694", fontWeight: 600 }}>{l.tested_by_qc ? "QC ✓" : "QC —"}</div>
            <button onClick={() => onEditLog(l)} style={{ background: "none", border: "none", color: "#8A9694" }}><Pencil size={13} /></button>
            {(["admin","super","owner"].includes(role)) && <button onClick={() => onDeleteLog(l)} style={{ background: "none", border: "none", color: "#C1432B" }}><Trash2 size={13} /></button>}
          </div>
        ))}
      </div>
    </div>
  );
}

const INSPECTION_REPORT_LABELS = {
  intact_container: "Intact container",
  complete_compound: "Complete components",
  expiration_validity: "Expiration validity",
  lot_matches_kit: "Lot matches kit components",
  storage_condition_ok: "Storage condition",
};

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function Reports({ reagents, logs, fridgeTempLogs, departments, role, onPurgeReagent, onPurgeLog }) {
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [searchLot, setSearchLot] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  // Most recent temperature reading logged for a fridge on/before a given date
  // (falls back to the most recent reading overall if none exist before it).
  function tempFor(fridgeName, onOrBefore) {
    if (!fridgeName) return null;
    const readings = (fridgeTempLogs || []).filter((t) => t.fridge_name === fridgeName);
    if (readings.length === 0) return null;
    const before = readings.filter((t) => t.date <= onOrBefore).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return before || readings.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  }
  // Full disposition of an expired lot, for the report badge.
  function expiredDisposition(r) {
    if (r.expiry_date >= todayISO()) return null;
    const usedFraction = r.quantity_received > 0 ? (r.quantity_received - r.current_quantity) / r.quantity_received : 0;
    if (usedFraction >= 0.95 || r.current_quantity <= 0) return { label: "Expired — fully used", color: "#2F6B4F", bg: "#E8F2EC" };
    if (usedFraction < 0.05) return { label: "⚠ Expired unused — disposed of (waste)", color: "#8A2E1F", bg: "#FBEAE6" };
    return { label: "Expired — partially used, remainder disposed", color: "#B8860B", bg: "#FBF3DF" };
  }

  const matchedLots = useMemo(() => {
    const term = searchLot.trim().toLowerCase();
    return reagents
      .filter((r) => !r.deleted)
      .filter((r) => (term ? r.lot_number.toLowerCase().includes(term) : r.date_added >= dateFrom && r.date_added <= dateTo))
      .filter((r) => (deptFilter ? r.department === deptFilter : true))
      .sort((a, b) => new Date(b.date_added) - new Date(a.date_added));
  }, [reagents, searchLot, dateFrom, dateTo, deptFilter]);

  function logsFor(reagentId) {
    return logs.filter((l) => l.reagent_id === reagentId && !l.deleted).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const rows = [];
    matchedLots.forEach((r) => {
      const rLogs = logsFor(r.id);
      const temp = tempFor(r.fridge_name, r.date_added);
      const base = {
        Reagent: r.name,
        Department: r.department,
        Type: r.item_type,
        Device: r.device || "",
        Fridge: r.fridge_name || "",
        "Fridge Temp (°C)": temp ? temp.temperature : "",
        "Lot Number": r.lot_number,
        "Received By": r.added_by,
        "Received Date": r.date_added,
        "Expiry Date": r.expiry_date,
        "Qty Received": r.quantity_received,
        "Qty Remaining": r.current_quantity,
        Unit: r.unit,
        "Intact Container": r.intact_container ? "Yes" : "No",
        "Complete Components": r.complete_compound ? "Yes" : "No",
        "Expiration Validity": r.expiration_validity ? "Yes" : "No",
        "Lot Matches Kit": r.lot_matches_kit ? "Yes" : "No",
        "Storage Condition": r.storage_condition_ok ? "Yes" : "No",
        "Receiving Note": r.receiving_notes || "",
        "Inspection Note": r.inspection_notes || "",
        "Expired Disposition": expiredDisposition(r)?.label.replace("⚠ ", "") || "",
      };
      if (rLogs.length === 0) {
        rows.push({ ...base, "Consumption Date": "", "Amount Used": "", "Used By": "", "Tested by QC": "" });
      } else {
        rLogs.forEach((l) => {
          rows.push({ ...base, "Consumption Date": l.date, "Amount Used": l.amount, "Used By": l.used_by, "Tested by QC": l.tested_by_qc ? "Yes" : "No" });
        });
      }
    });
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "No records match this filter." }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Report");
    XLSX.writeFile(wb, `reagent-report-${dateFrom}-to-${dateTo}.xlsx`);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Full report</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} className="no-print" style={{ background: "none", border: "1px solid #C7D1CE", color: "#516361", borderRadius: 7, padding: "8px 12px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Printer size={14} /> Print</button>
          <button onClick={exportExcel} className="no-print" style={{ background: "#0F7173", color: "#fff", border: "none", borderRadius: 7, padding: "8px 12px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Download size={14} /> Export Excel</button>
        </div>
      </div>

      <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#7B8E8A" }}>From</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ border: "1px solid #C7D1CE", borderRadius: 6, padding: "7px 10px", fontSize: 13 }} />
          <span style={{ fontSize: 12, color: "#7B8E8A" }}>To</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ border: "1px solid #C7D1CE", borderRadius: 6, padding: "7px 10px", fontSize: 13 }} />
        </div>
        <input
          placeholder="Search by lot number…"
          value={searchLot}
          onChange={(e) => setSearchLot(e.target.value)}
          style={{ border: "1px solid #C7D1CE", borderRadius: 6, padding: "7px 10px", fontSize: 13, flex: 1, minWidth: 180 }}
        />
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} style={{ border: "1px solid #C7D1CE", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      {searchLot.trim() && <div style={{ fontSize: 12, color: "#8A9694", marginBottom: 10 }}>Searching by lot number — date filter is ignored while searching.</div>}

      {matchedLots.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#8A9694", fontSize: 13.5 }}>No records match this filter.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {matchedLots.map((r) => {
          const rLogs = logsFor(r.id);
          const failedItems = Object.keys(INSPECTION_REPORT_LABELS).filter((k) => r[k] === false);
          const temp = tempFor(r.fridge_name, r.date_added);
          const disposition = expiredDisposition(r);
          return (
            <div key={r.id} style={{ background: "#fff", border: r.deleted ? "1px solid #C1432B55" : "1px solid #E1E8E5", borderRadius: 10, padding: 16, opacity: r.deleted ? 0.75 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                  {r.name}
                  {r.deleted && <span className="no-print" style={{ fontSize: 10, fontWeight: 700, color: "#C1432B", background: "#FBEAE6", padding: "2px 7px", borderRadius: 4 }}>DELETED by {r.deleted_by} · {fmtDateTime(r.deleted_at)}</span>}
                  {r.deleted && ["super","owner"].includes(role) && (
                    <button onClick={() => onPurgeReagent(r.id)} className="no-print" style={{ background: "none", border: "1px solid #C1432B", color: "#C1432B", borderRadius: 6, padding: "3px 9px", fontSize: 10.5, fontWeight: 700 }}>Erase permanently</button>
                  )}
                  {disposition && <span style={{ fontSize: 10, fontWeight: 700, color: disposition.color, background: disposition.bg, padding: "2px 7px", borderRadius: 4 }}>{disposition.label}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: "#7B8E8A", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {r.department} · {r.item_type} · Lot {r.lot_number}{r.device ? ` · ${r.device}` : ""}{r.fridge_name ? ` · ${r.fridge_name}` : ""}{temp ? ` · ${temp.temperature}°C (${temp.date})` : ""}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 12, fontSize: 12.5 }}>
                <div><div style={{ color: "#8A9694", fontSize: 10.5, textTransform: "uppercase" }}>Received by</div>{r.added_by}</div>
                <div><div style={{ color: "#8A9694", fontSize: 10.5, textTransform: "uppercase" }}>Received date</div>{r.date_added}</div>
                <div><div style={{ color: "#8A9694", fontSize: 10.5, textTransform: "uppercase" }}>Expiry date</div>{r.expiry_date}</div>
                <div><div style={{ color: "#8A9694", fontSize: 10.5, textTransform: "uppercase" }}>Quantity</div>{r.current_quantity}/{r.quantity_received} {r.unit}</div>
                {r.fridge_name && (
                  <div><div style={{ color: "#8A9694", fontSize: 10.5, textTransform: "uppercase" }}>Fridge</div>{r.fridge_name}{temp ? ` (${temp.temperature}°C)` : ""}</div>
                )}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {Object.entries(INSPECTION_REPORT_LABELS).map(([key, label]) => (
                  <span key={key} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: r[key] ? "#E8F2EC" : "#FBEAE6", color: r[key] ? "#2F6B4F" : "#C1432B", fontWeight: 600 }}>
                    {r[key] ? "✓" : "✕"} {label}
                  </span>
                ))}
              </div>
              {failedItems.length > 0 && (
                <div style={{ fontSize: 11.5, color: "#8A2E1F", marginBottom: 10 }}>⚠ Inspection issue on receipt</div>
              )}
              {(r.receiving_notes || r.inspection_notes) && (
                <div style={{ fontSize: 12, color: "#516361", marginBottom: 12, background: "#F7F9F8", border: "1px solid #E1E8E5", borderRadius: 6, padding: "8px 10px" }}>
                  {r.receiving_notes && <div><b>Receiving note:</b> {r.receiving_notes}</div>}
                  {r.inspection_notes && <div><b>Inspection note:</b> {r.inspection_notes}</div>}
                </div>
              )}

              <div style={{ fontSize: 11, fontWeight: 700, color: "#7B8E8A", marginBottom: 6, letterSpacing: 0.3 }}>USAGE LOG</div>
              {rLogs.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "#8A9694" }}>No usage recorded yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {rLogs.map((l) => (
                    <div key={l.id} style={{ display: "flex", gap: 12, fontSize: 12.5, padding: "6px 0", borderTop: "1px solid #EEF2F0", opacity: l.deleted ? 0.6 : 1 }}>
                      <div style={{ width: 88, color: "#8A9694", fontFamily: "'IBM Plex Mono', monospace" }}>{l.date}</div>
                      <div style={{ flex: 1 }}>−{l.amount} {r.unit} by <b>{l.used_by}</b> {l.deleted && <span className="no-print" style={{ color: "#C1432B", fontWeight: 700 }}>(deleted by {l.deleted_by} · {fmtDateTime(l.deleted_at)})</span>}</div>
                      {l.deleted && ["super","owner"].includes(role) && (
                        <button onClick={() => onPurgeLog(l.id)} className="no-print" style={{ background: "none", border: "1px solid #C1432B", color: "#C1432B", borderRadius: 6, padding: "2px 8px", fontSize: 10.5, fontWeight: 700 }}>Erase</button>
                      )}
                      <div style={{ color: l.tested_by_qc ? "#2F6B4F" : "#8A9694", fontWeight: 600 }}>{l.tested_by_qc ? "QC ✓" : "QC —"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeletionsLog({ activityLog, onClear }) {
  const ACTION_META = {
    receive: { label: "Received", color: "#2F6B4F", bg: "#E8F2EC" },
    log_use: { label: "Logged use", color: "#0F7173", bg: "#EAF6F4" },
    edit: { label: "Edited", color: "#B8860B", bg: "#FBF3DF" },
    delete: { label: "Removed", color: "#C1432B", bg: "#FBEAE6" },
    purge: { label: "Erased permanently", color: "#8A2E1F", bg: "#FBEAE6" },
    bulk_import: { label: "Bulk imported", color: "#2F6B4F", bg: "#E8F2EC" },
    settings_change: { label: "Settings changed", color: "#516361", bg: "#F0F3F2" },
    preset_add: { label: "Preset added", color: "#516361", bg: "#F0F3F2" },
    preset_delete: { label: "Preset removed", color: "#516361", bg: "#F0F3F2" },
    device_add: { label: "Device added", color: "#516361", bg: "#F0F3F2" },
    device_delete: { label: "Device removed", color: "#516361", bg: "#F0F3F2" },
    staff_add: { label: "Employee account added", color: "#516361", bg: "#F0F3F2" },
    staff_role_change: { label: "Employee role changed", color: "#3E6ACF", bg: "#E7EEFB" },
    staff_remove: { label: "Employee account removed", color: "#516361", bg: "#F0F3F2" },
    department_add: { label: "Department added", color: "#516361", bg: "#F0F3F2" },
    department_remove: { label: "Department removed", color: "#516361", bg: "#F0F3F2" },
    fridge_count: { label: "Fridge count logged", color: "#3E6ACF", bg: "#E7EEFB" },
    fridge_count_delete: { label: "Fridge count removed", color: "#C1432B", bg: "#FBEAE6" },
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Activity log</h2>
        {activityLog.length > 0 && (
          <button onClick={onClear} style={{ background: "none", border: "1px solid #C1432B", color: "#C1432B", borderRadius: 7, padding: "7px 12px", fontSize: 12.5, fontWeight: 700 }}>
            Clear all activity
          </button>
        )}
      </div>
      <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 24 }}>Every edit, removal, and permanent erase — in order, newest first. Only visible to your account.</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {activityLog.length === 0 && <div style={{ fontSize: 13, color: "#8A9694" }}>No activity recorded yet.</div>}
        {activityLog.map((e) => {
          const m = ACTION_META[e.action] || { label: e.action, color: "#516361", bg: "#F0F3F2" };
          return (
            <div key={e.id} style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: m.color, background: m.bg, padding: "3px 8px", borderRadius: 4, textTransform: "uppercase", flexShrink: 0 }}>{m.label}</span>
              <div style={{ flex: 1, fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>{e.description}</div>
                <div style={{ fontSize: 11.5, color: "#8A9694", marginTop: 2 }}>{ENTITY_LABELS[e.entity] || e.entity} · by <b>{e.performed_by}</b> on {fmtDateTime(e.performed_at)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,25,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 440, maxHeight: "88vh", overflowY: "auto", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8A9694" }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", border: "1px solid #C7D1CE", borderRadius: 7, padding: "9px 11px", fontSize: 14, marginTop: 4, boxSizing: "border-box" };
const labelStyle = { fontSize: 12.5, fontWeight: 600, color: "#516361" };

function LogConsumptionModal({ reagents, onClose, onSubmit }) {
  const [typeFilter, setTypeFilter] = useState("");
  const filteredReagents = typeFilter ? reagents.filter((r) => r.item_type === typeFilter) : reagents;
  const names = [...new Set(filteredReagents.map((r) => r.name))];
  const [name, setName] = useState(names[0] || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [usedBy, setUsedBy] = useState("");
  const [note, setNote] = useState("");
  const [testedByQC, setTestedByQC] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const lots = reagents.filter((r) => r.name === name).sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
  const fefo = lots[0];

  function changeType(t) {
    setTypeFilter(t);
    const list = t ? reagents.filter((r) => r.item_type === t) : reagents;
    const firstName = [...new Set(list.map((r) => r.name))][0] || "";
    setName(firstName);
  }

  function handleScan(text) {
    const match = reagents.find((r) => r.lot_number === text);
    if (match) setName(match.name);
    setShowScanner(false);
  }

  function submit() {
    if (!fefo || !amount || !usedBy) return;
    onSubmit({ reagentId: fefo.id, amount: Number(amount), date, usedBy, note, testedByQC });
  }

  if (reagents.length === 0) {
    return <Modal title="Log consumption" onClose={onClose}><div style={{ fontSize: 13.5, color: "#7B8E8A" }}>No reagents in inventory yet. Receive stock first.</div></Modal>;
  }

  return (
    <Modal title="Log daily consumption" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={labelStyle}>Type
          <select style={inputStyle} value={typeFilter} onChange={(e) => changeType(e.target.value)}>
            <option value="">All types</option>
            <option value="Reagent">Reagent</option>
            <option value="QC">QC</option>
            <option value="Cal">Cal</option>
          </select>
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <label style={{ ...labelStyle, flex: 1 }}>Reagent (click to browse, or type to search)
            <SearchableSelect value={name} onChange={setName} options={names} placeholder="Search reagent name" allowCustom={false} style={{ marginTop: 4 }} />
          </label>
          <button type="button" onClick={() => setShowScanner(true)} style={{ background: "#F0F3F2", border: "1px solid #C7D1CE", borderRadius: 7, padding: "9px 10px" }}><ScanLine size={16} /></button>
        </div>
        {names.length === 0 && <div style={{ fontSize: 12.5, color: "#8A9694" }}>No items of this type in stock.</div>}
        {fefo && (
          <div style={{ background: "#EAF6F4", border: "1px solid #C6E8E3", borderRadius: 7, padding: "9px 12px", fontSize: 12.5, color: "#0F5F5B" }}>
            FEFO suggests <b>Lot {fefo.lot_number}</b> ({fefo.current_quantity} {fefo.unit} left, expires {fefo.expiry_date}){lots.length > 1 ? ` — ${lots.length} lots available` : ""}
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ ...labelStyle, flex: 1 }}>Amount used ({fefo?.unit || "unit"})<input type="number" style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <label style={{ ...labelStyle, flex: 1 }}>Date<input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
        <label style={labelStyle}>Used by<input style={inputStyle} value={usedBy} onChange={(e) => setUsedBy(e.target.value)} placeholder="Your name" /></label>
        <label style={labelStyle}>Note (optional)<input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. daily QC run" /></label>
        <YesNoRow label="Tested by QC" value={testedByQC} onChange={setTestedByQC} />
        <button onClick={submit} style={{ marginTop: 6, background: "#0F7173", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14 }}>Save log</button>
      </div>
      {showScanner && <BarcodeScanner onClose={() => setShowScanner(false)} onDetected={handleScan} />}
    </Modal>
  );
}

function EditReagentModal({ reagent, onClose, onSave }) {
  const [form, setForm] = useState({ ...reagent });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title={`Edit lot ${reagent.lot_number}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={labelStyle}>Lot number<input style={inputStyle} value={form.lot_number} onChange={set("lot_number")} /></label>
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ ...labelStyle, flex: 1 }}>Quantity received<input type="number" style={inputStyle} value={form.quantity_received} onChange={set("quantity_received")} /></label>
          <label style={{ ...labelStyle, flex: 1 }}>Current quantity<input type="number" style={inputStyle} value={form.current_quantity} onChange={set("current_quantity")} /></label>
        </div>
        <label style={labelStyle}>Expiry date<input type="date" style={inputStyle} value={form.expiry_date} onChange={set("expiry_date")} /></label>
        <label style={labelStyle}>Low stock alert below<input type="number" style={inputStyle} value={form.low_stock_threshold} onChange={set("low_stock_threshold")} /></label>
        <button
          onClick={() => onSave({ ...form, quantity_received: Number(form.quantity_received), current_quantity: Number(form.current_quantity), low_stock_threshold: Number(form.low_stock_threshold) })}
          style={{ marginTop: 6, background: "#0F7173", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14 }}
        >Save changes</button>
      </div>
    </Modal>
  );
}

function EditLogModal({ log, onClose, onSave }) {
  const [form, setForm] = useState({ ...log });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title="Edit consumption log" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={labelStyle}>Amount<input type="number" style={inputStyle} value={form.amount} onChange={set("amount")} /></label>
        <label style={labelStyle}>Date<input type="date" style={inputStyle} value={form.date} onChange={set("date")} /></label>
        <label style={labelStyle}>Used by<input style={inputStyle} value={form.used_by} onChange={set("used_by")} /></label>
        <label style={labelStyle}>Note<input style={inputStyle} value={form.note || ""} onChange={set("note")} /></label>
        <YesNoRow label="Tested by QC" value={form.tested_by_qc} onChange={(v) => setForm((f) => ({ ...f, tested_by_qc: v }))} />
        <button onClick={() => onSave({ ...form, amount: Number(form.amount) }, log)} style={{ marginTop: 6, background: "#0F7173", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14 }}>Save changes</button>
      </div>
    </Modal>
  );
}
