import React, { useState } from "react";
import { Truck, Plus, Trash2, Pencil, X } from "lucide-react";
import { supabase } from "./supabaseClient";

const inputStyle = { width: "100%", border: "1px solid #C7D1CE", borderRadius: 7, padding: "9px 11px", fontSize: 14, marginTop: 4, boxSizing: "border-box" };
const labelStyle = { fontSize: 12.5, fontWeight: 600, color: "#516361" };
const emptyForm = { name: "", contact_person: "", phone: "", email: "", notes: "" };

export default function Suppliers({ suppliers, reload, logActivity, canEdit }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }
  function openEdit(s) {
    setEditing(s.id);
    setForm({ name: s.name, contact_person: s.contact_person, phone: s.phone, email: s.email, notes: s.notes || "" });
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim()) return;
    if (editing) {
      await supabase.from("suppliers").update(form).eq("id", editing);
      await logActivity?.("settings_change", "config", `Supplier "${form.name}" updated`);
    } else {
      await supabase.from("suppliers").insert(form);
      await logActivity?.("settings_change", "config", `Supplier "${form.name}" added`);
    }
    setShowForm(false);
    reload();
  }

  async function remove(s) {
    if (!confirm(`Remove supplier "${s.name}"?`)) return;
    await supabase.from("suppliers").delete().eq("id", s.id);
    await logActivity?.("settings_change", "config", `Supplier "${s.name}" removed`);
    reload();
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><Truck size={20} /> Suppliers</h2>
        {canEdit && (
          <button onClick={openNew} style={{ background: "var(--accent-1)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Add supplier
          </button>
        )}
      </div>
      <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 20 }}>Reagent and equipment suppliers, with contact details.</div>

      {showForm && (
        <div style={{ background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{editing ? "Edit supplier" : "New supplier"}</div>
            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "#8A9694" }}><X size={16} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 10 }}>
            <label style={labelStyle}>Company name<input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
            <label style={labelStyle}>Contact person<input style={inputStyle} value={form.contact_person} onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))} /></label>
            <label style={labelStyle}>Phone<input style={inputStyle} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></label>
            <label style={labelStyle}>Email<input style={inputStyle} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></label>
          </div>
          <label style={labelStyle}>Notes<input style={inputStyle} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></label>
          <button onClick={save} style={{ marginTop: 12, background: "var(--accent-1)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 13 }}>
            {editing ? "Save changes" : "Add supplier"}
          </button>
        </div>
      )}

      {(!suppliers || suppliers.length === 0) ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#8A9694", fontSize: 13.5 }}>No suppliers added yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {suppliers.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", border: "1px solid #E1E8E5", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{s.name}</div>
                <div style={{ fontSize: 12.5, color: "#7B8E8A", marginTop: 2 }}>
                  {s.contact_person && <span>{s.contact_person} · </span>}
                  {s.phone && <span>{s.phone} · </span>}
                  {s.email}
                </div>
                {s.notes && <div style={{ fontSize: 12, color: "#8A9694", marginTop: 4 }}>{s.notes}</div>}
              </div>
              {canEdit && (
                <>
                  <button onClick={() => openEdit(s)} style={{ background: "none", border: "none", color: "#516361" }}><Pencil size={15} /></button>
                  <button onClick={() => remove(s)} style={{ background: "none", border: "none", color: "#C1432B" }}><Trash2 size={15} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
