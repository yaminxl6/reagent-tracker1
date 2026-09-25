import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { Printer, X } from "lucide-react";

// A printable label for one reagent lot. Encodes the lot's own database id
// (not the lot number) so a scan always matches the exact lot, even if two
// different lots happen to share the same manufacturer lot number. A QR
// code — not a 1D barcode — because the id is a full UUID; at small label
// sizes a QR stays far more compact than a 1D barcode encoding the same
// string would.
//
// The actual print output is a React portal into #print-root (a sibling of
// #root in index.html), not this modal's own DOM. Printing whatever's on
// screen — even with the rest hidden via CSS visibility — leaves the full
// app's height in the page layout (visibility:hidden doesn't collapse it),
// which paginated into ~150 near-blank pages in testing. Hiding #root
// outright and printing only the portaled content fixed that — but the
// first fix then shrank the QR down to ~16mm physical size to force it
// onto one page, which was too small to scan: the camera opened but never
// detected anything. A QR encoding a 36-character UUID needs real size to
// stay scannable, so the printed version now renders at a high internal
// resolution (crisp on paper) but is fixed to a real 32mm physical size
// via mm units — the @page size below was measured against that exact
// content height so it still prints as one page, not "shrink until it
// fits".
function LabelContent({ reagent, qrRenderSize, qrDisplaySize, fontScale }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && reagent) {
      // toCanvas sets the canvas's own inline width/height style to match
      // its pixel size — it has to be re-applied after the draw finishes,
      // or a physical print size set via qrDisplaySize gets silently
      // clobbered back to the render resolution in pixels.
      QRCode.toCanvas(canvasRef.current, reagent.id, { width: qrRenderSize, margin: 0 }).then(() => {
        if (canvasRef.current && qrDisplaySize) {
          canvasRef.current.style.width = qrDisplaySize;
          canvasRef.current.style.height = qrDisplaySize;
        }
      });
    }
  }, [reagent, qrRenderSize, qrDisplaySize]);

  return (
    <div id="barcode-label-print" style={{ textAlign: "center" }}>
      <div style={{ fontWeight: 700, fontSize: 13 * fontScale, marginBottom: 4 * fontScale }}>{reagent.name}</div>
      <canvas ref={canvasRef} style={qrDisplaySize ? { width: qrDisplaySize, height: qrDisplaySize } : { maxWidth: "100%" }} />
      <div style={{ fontSize: 11 * fontScale, color: "#516361", marginTop: 4 * fontScale }}>لوت {reagent.lot_number}{reagent.expiry_date ? ` · ينتهي ${reagent.expiry_date}` : ""}</div>
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

      {printRoot && createPortal(<LabelContent reagent={reagent} qrRenderSize={320} qrDisplaySize="32mm" fontScale={0.85} />, printRoot)}

      <style>{`
        #print-root { display: none; }
        @media print {
          #root { display: none !important; }
          #print-root { display: block !important; width: 38mm; padding: 2mm 1mm; }
          @page { size: 40mm 56mm; margin: 0; }
        }
      `}</style>
    </div>
  );
}
