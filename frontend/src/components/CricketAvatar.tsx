import React from "react";

export default function CricketAvatar({
  seed,
  jerseyNumber,
  jerseyColor
}: {
  seed: string;
  jerseyNumber?: number | null;
  jerseyColor?: string | null;
}) {
  const baseColor = jerseyColor || "#1e3a8a";

  // Determine trim color based on jersey brightness
  const hex = baseColor.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const isLight = (r * 299 + g * 587 + b * 114) / 1000 > 128;
  const trimColor = isLight ? "#111111" : "#ffffff";

  const backNumber = jerseyNumber != null
    ? jerseyNumber.toString().padStart(2, "0")
    : "00";

  const initial = seed[0].toUpperCase();

  return (
    <div className="w-full h-full relative flex items-center justify-center drop-shadow-lg">
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] transition-transform group-hover:scale-110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M25 15 L40 5 L60 5 L75 15 L95 40 L80 55 L75 45 L75 95 L25 95 L25 45 L20 55 L5 40 Z"
          fill={baseColor}
          stroke={trimColor}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M40 5 Q 50 15 60 5" stroke={trimColor} strokeWidth="4" fill="none" />
        <line x1="20" y1="20" x2="35" y2="35" stroke={trimColor} strokeWidth="2" />
        <line x1="80" y1="20" x2="65" y2="35" stroke={trimColor} strokeWidth="2" />
        <text x="50" y="40" fontFamily="monospace" fontSize="18" fontWeight="900" fill={trimColor} textAnchor="middle" dominantBaseline="middle">
          {initial}
        </text>
        <text x="50" y="70" fontFamily="sans-serif" fontSize="26" fontWeight="900" fill={trimColor} textAnchor="middle" dominantBaseline="middle" opacity="0.9">
          {backNumber}
        </text>
      </svg>
    </div>
  );
}
