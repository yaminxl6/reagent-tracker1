import React from "react";

// A stylized fridge with a semi-transparent glass door. `fillLevel` (0-1)
// controls how many "shelves" of items show, and `itemCount` shows a
// small badge. No external images — fully self-contained SVG so it never
// breaks and never depends on network access.
export default function FridgeIcon({ size = 88, itemCount = 0, accent = "#3E6ACF" }) {
  const shelves = [30, 46, 62, 78]; // y-positions for item rows inside the door
  const showCount = Math.min(itemCount, 8);

  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 88 101" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <rect x="6" y="4" width="76" height="93" rx="8" fill="#EAF0F5" stroke="#B9C6D6" strokeWidth="2" />
      {/* Top freezer line */}
      <line x1="6" y1="24" x2="82" y2="24" stroke="#B9C6D6" strokeWidth="2" />
      {/* Glass door panel (semi-transparent) */}
      <rect x="14" y="30" width="60" height="60" rx="6" fill={accent} opacity="0.12" stroke={accent} strokeOpacity="0.5" strokeWidth="1.5" />
      {/* Handle */}
      <rect x="76" y="10" width="4" height="10" rx="2" fill="#8FA3B8" />
      <rect x="76" y="34" width="4" height="14" rx="2" fill="#8FA3B8" />
      {/* Items inside, visible through the glass */}
      {Array.from({ length: showCount }).map((_, i) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        return (
          <rect key={i} x={20 + col * 13} y={38 + row * 22} width="8" height="14" rx="2" fill={accent} opacity="0.75" />
        );
      })}
    </svg>
  );
}
