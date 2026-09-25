import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { Printer, X } from "lucide-react";

// A printable label for one reagent lot. Encodes the lot's own database id
// (not the lot number) so a scan always matches the exact lot, even if two
// different lots happen to share the same manufacturer lot number.
//
// Printed via a React portal into #print-root (a sibling of #root in
// index.html) with #root hidden outright for print — printing the modal
// in place, even with the rest hidden via CSS visibility, left the whole
// app's height in the page layout and paginated into ~150 blank pages.
//
// Page geometry: @page 44x34mm with a 1mm margin is what actually printed
// correctly-sized on a real Zebra GK420t label printer in testing — a
// later attempt at 40x56mm with margin 0 broke the fit entirely on that
// same printer. A label printer like the GK420t is driven by whatever
// stock size its own driver is configured for; @page is a request that
// printer either honors closely (as it did at 44x34mm) or overrides
// entirely, so this stays on the proven size instead of guessing a new
// one, and the QR fills the available box proportionally (via CSS,
// percentage of its container) rather than a fixed mm value that could
// again mismatch whatever page geometry actually gets used.
function LabelContent({ reagent, qrRenderSize, fillContainer, fontScale }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && reagent) {
      QRCode.toCanvas(canvasRef.current, reagent.id, { width: qrRenderSize, margin: 0 }).then(() => {
        // toCanvas sets the canvas's own inline width/height to its pixel
        // size after drawing — clobbers any container-relative sizing
        // unless reapplied afterward.
        if (canvasRef.current && fillContainer) {
          canvasRef.current.style.width = "60%";
          canvasRef.current.style.height = "auto";
        }
      });
    }
  }, [reagent, qrRenderSize, fillContainer]);

  return (
    <div id="barcode-label-print" style={{ textAlign: "center" }}>
      <div style={{ fontWeight: 700, fontSize: 13 * fontScale, marginBottom: 2 * fontScale }}>{reagent.name}</div>
      <canvas ref={canvasRef} style={fillContainer ? { width: "60%", height: "auto" } : { maxWidth: "100%" }} />
      <div style={{ fontSize: 11 * fontScale, color: "#516361", marginTop: 2 * fontScale }}>لوت {reagent.lot_number}{reagent.expiry_date ? ` · ينتهي ${reagent.expiry_date}` : ""}</div>
    </div>
  );
}

export default function BarcodeLabel({ reagent, title, onClose }) {
  if (!reagent) return null;
  const printRoot = document.getElementById("print-root");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,25,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60 }} className="no-print">
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 360, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title || "باركود اللوت"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8A9694" }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 16 }}>تبي تطبع باركود تلصقه على العبوة أو الكرتون؟ امسحه لاحقاً بدل ما تدخل بياناته يدوي.</div>

        <div style={{ border: "1px dashed #C7D1CE", borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <LabelContent reagent={reagent} qrRenderSize={140} fontScale={1} />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: "#F0F3F2", color: "#1B2B2E", border: "1px solid #C7D1CE", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14 }}>تخطي</button>
          <button onClick={() => window.print()} style={{ flex: 2, background: "#0F7173", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Printer size={15} /> اطبع الباركود
          </button>
        </div>
      </div>

      {printRoot && createPortal(<LabelContent reagent={reagent} qrRenderSize={280} fillContainer fontScale={0.75} />, printRoot)}

      <style>{`
        #print-root { display: none; }
        @media print {
          #root { display: none !important; }
          #print-root { display: block !important; width: 32mm; padding: 1mm; }
          @page { size: 34mm 44mm; margin: 1mm; }
        }
      `}</style>
    </div>
  );
}
