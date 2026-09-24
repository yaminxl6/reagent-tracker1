import React, { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Printer, X } from "lucide-react";

// A printable label for one reagent lot. Encodes the lot's own database id
// (not the lot number) so a scan always matches the exact lot, even if two
// different lots happen to share the same manufacturer lot number. A QR
// code — not a 1D barcode — because the id is a full UUID; at label sizes
// around 3-5cm a QR stays compact and easy to scan, where a 1D barcode
// encoding the same string would run too wide to fit.
export default function BarcodeLabel({ reagent, title, onClose }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && reagent) {
      QRCode.toCanvas(canvasRef.current, reagent.id, { width: 132, margin: 0 });
    }
  }, [reagent]);

  if (!reagent) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,25,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60 }}>
      <div className="no-print" style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 360, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title || "تم تسجيل اللوت ✓"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8A9694" }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 13, color: "#7B8E8A", marginBottom: 16 }}>تبي تطبع باركود تلصقه على العبوة أو الكرتون؟ امسحه لاحقاً بدل ما تدخل بياناته يدوي.</div>

        <div id="barcode-label-print" style={{ border: "1px dashed #C7D1CE", borderRadius: 8, padding: 14, textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{reagent.name}</div>
          <canvas ref={canvasRef} style={{ maxWidth: "100%" }} />
          <div style={{ fontSize: 11, color: "#516361", marginTop: 8 }}>لوت {reagent.lot_number}{reagent.expiry_date ? ` · ينتهي ${reagent.expiry_date}` : ""}</div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: "#F0F3F2", color: "#1B2B2E", border: "1px solid #C7D1CE", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14 }}>تخطي</button>
          <button onClick={() => window.print()} style={{ flex: 2, background: "#0F7173", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Printer size={15} /> اطبع الباركود
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #barcode-label-print, #barcode-label-print * { visibility: visible; }
          #barcode-label-print {
            position: fixed; top: 0; left: 0;
            border: none !important;
            width: 48mm;
            padding: 1mm !important;
          }
          @page { size: 50mm 30mm; margin: 1mm; }
        }
      `}</style>
    </div>
  );
}
