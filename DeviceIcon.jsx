import React from "react";

// A stylized lab analyzer/instrument — generic enough to represent any
// device (VIDAS, Cobas, Becman Coulter...), with a screen and status
// lights. Self-contained SVG, no external images.
export default function DeviceIcon({ size = 88, accent = "#0F9B8E" }) {
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 88 79" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Base / body */}
      <rect x="4" y="20" width="80" height="52" rx="8" fill="#EAF0F5" stroke="#B9C6D6" strokeWidth="2" />
      {/* Top slanted control panel */}
      <path d="M8 20 L18 6 H70 L80 20 Z" fill="#DCE6EF" stroke="#B9C6D6" strokeWidth="2" />
      {/* Screen */}
      <rect x="26" y="10" width="36" height="8" rx="2" fill={accent} opacity="0.7" />
      {/* Sample slot */}
      <rect x="14" y="32" width="24" height="30" rx="4" fill={accent} opacity="0.15" stroke={accent} strokeOpacity="0.5" strokeWidth="1.5" />
      <rect x="20" y="40" width="4" height="14" rx="2" fill={accent} opacity="0.8" />
      <rect x="27" y="36" width="4" height="18" rx="2" fill={accent} opacity="0.6" />
      {/* Status lights */}
      <circle cx="50" cy="40" r="3" fill="#2F8F5B" />
      <circle cx="60" cy="40" r="3" fill="#D8862B" />
      <rect x="46" y="50" width="26" height="12" rx="3" fill="#DCE6EF" stroke="#B9C6D6" strokeWidth="1.5" />
    </svg>
  );
}
