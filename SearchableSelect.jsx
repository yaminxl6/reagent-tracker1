import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

// A real dropdown: click to open a list, type to filter it live, click an
// option to pick it. Works consistently everywhere (native <input list>
// datalist support varies a lot between mobile browsers).
export default function SearchableSelect({ value, onChange, options, placeholder, allowCustom = true, style }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const boxRef = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
        if (allowCustom) onChange(query);
        else if (!options.includes(query)) { setQuery(value || ""); }
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("touchstart", onClickOutside);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("touchstart", onClickOutside);
    };
  }, [query, options, allowCustom, value, onChange]);

  const filtered = options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()));

  function pick(opt) {
    setQuery(opt);
    onChange(opt);
    setOpen(false);
  }

  return (
    <div ref={boxRef} style={{ position: "relative", ...style }}>
      <div style={{ display: "flex", alignItems: "center", border: "1px solid #C7D1CE", borderRadius: 7, background: "#fff" }}>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          style={{ flex: 1, border: "none", padding: "9px 10px", fontSize: 14, borderRadius: 7, outline: "none", minWidth: 0 }}
        />
        {query && (
          <button type="button" onClick={() => { setQuery(""); onChange(""); }} style={{ background: "none", border: "none", color: "#8A9694", padding: "0 6px" }}><X size={13} /></button>
        )}
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ background: "none", border: "none", color: "#8A9694", padding: "0 8px", display: "flex" }}><ChevronDown size={15} /></button>
      </div>
      {open && (
        <div style={{ position: "absolute", zIndex: 30, top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #C7D1CE", borderRadius: 7, marginTop: 3, maxHeight: 220, overflowY: "auto", boxShadow: "0 6px 16px rgba(0,0,0,0.12)" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: 13, color: "#8A9694" }}>{allowCustom ? "No matches — you can still type a new one." : "No matches."}</div>
          ) : (
            filtered.map((opt) => (
              <div
                key={opt}
                onClick={() => pick(opt)}
                style={{ padding: "9px 12px", fontSize: 13.5, cursor: "pointer", borderBottom: "1px solid #F0F3F2" }}
                onMouseDown={(e) => e.preventDefault()}
              >
                {opt}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
