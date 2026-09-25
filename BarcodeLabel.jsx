import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { Printer, X } from "lucide-react";

// A printable label for one reagent lot. Encodes the lot's own database id
// (not the lot number) so a scan always matches the exact lot, even if two
// different lots happen to share the same manufacturer lot number. A QR
// code — not a 1D barcode — because the id is a full UUID; at label sizes
// around 3-5cm a QR stays compact and easy to scan, where a 1D barcode
// encoding the same string would run too wide to fit.
//
// The actual print output is a React portal into #print-root (a sibling of
// #root in index.html), not this modal's own DOM. Printing whatever's on
// screen — even with the rest hidden via CSS visibility — leaves the full
// app's height in the page layout (visibility:hidden doesn't collapse it),
// which paginated into ~150 near-blank pages in testing. Hiding #root
// outright and printing only the portaled content fixes that.
//
// The print version renders noticeably smaller than the on-screen preview
// (qrSize prop) — a 42x30mm label has ~28mm of usable height after margins,
// and the on-screen preview's comfortable 140px QR alone is already ~37mm,
// taller than the whole label. Measured with a real print-to-PDF: at
// qrSize 72 this fits on exactly one page; the on-screen size stayed larger
// since it only needs to be readable in a modal, not fit on paper.
function LabelContent({ reagent, qrSize, fontScale }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && reagent) {
      QRCode.toCanvas(canvasRef.current, reagent.id, { width: qrSize, margin: 0 });
    }
  }, [reagent, qrSize]);

  return (
    <div id="barcode-label-print" style={{ textAlign: "center" }}>
      <div style={{ fontWeight: 700, fontSize: 13 * fontScale, marginBottom: 4 * fontScale }}>{reagent.name}</div>
      <canvas ref={canvasRef} style={{ maxWidth: "100%" }} />
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
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title || "تم تسجيل اللوت ✓"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8A9694" }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 16 }}>تبي تطبع باركود تلصقه على العبوة أو الكرتون؟ امسحه لاحقاً بدل ما تدخل بياناته يدوي.</div>

        <div style={{ border: "1px dashed #C7D1CE", borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <LabelContent reagent={reagent} qrSize={140} fontScale={1} />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: "#F0F3F2", color: "#1B2B2E", border: "1px solid #C7D1CE", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14 }}>تخطي</button>
          <button onClick={() => window.print()} style={{ flex: 2, background: "#0F7173", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Printer size={15} /> اطبع الباركود
          </button>
        </div>
      </div>

      {printRoot && createPortal(<LabelContent reagent={reagent} qrSize={62} fontScale={0.6} />, printRoot)}

      <style>{`
        #print-root { display: none; }
        @media print {
          #root { display: none !important; }
          #print-root { display: block !important; width: 42mm; padding: 1mm; }
          @page { size: 44mm 34mm; margin: 1mm; }
        }
      `}</style>
    </div>
  );
}
