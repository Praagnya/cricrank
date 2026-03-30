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
  // Hash the seed to deterministically pick a team color scheme
  const colors = [
    { base: "#1e3a8a", trim: "#fbbf24" }, // Blue & Gold (MUM)
    { base: "#fbbf24", trim: "#ef4444" }, // Yellow & Red (CHE)
    { base: "#7f1d1d", trim: "#fcd34d" }, // Dark Red & Gold (BAN)
    { base: "#831843", trim: "#fbcfe8" }, // Pink & Light Pink (RAJ)
    { base: "#3730a3", trim: "#c7d2fe" }, // Deep Purple & Indigo (KOL)
    { base: "#064e3b", trim: "#34d399" }, // Dark Green & Emerald (DEL)
    { base: "#991b1b", trim: "#ffffff" }, // Red & White (PUN)
    { base: "#ea580c", trim: "#000000" }, // Orange & Black (HYD)
    { base: "#0f172a", trim: "#38bdf8" }, // Navy & Sky (LUC)
    { base: "#172554", trim: "#2dd4bf" }, // Midnight & Teal (GUJ)
  ];
  
  const hash = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const palette = colors[hash % colors.length];
  
  const numberMatch = seed.match(/\d{1,2}/);
  const backNumber = jerseyNumber != null 
    ? jerseyNumber.toString().padStart(2, '0') 
    : (numberMatch ? numberMatch[0] : seed.charCodeAt(0) % 99 + 1);
    
  const initial = seed[0].toUpperCase();
  
  const finalBaseColor = jerseyColor || palette.base;
  const finalTrimColor = jerseyColor ? "#ffffff" : palette.trim; // Default to white trim on custom colors

  return (
    <div className="w-full h-full relative flex items-center justify-center drop-shadow-lg">
      <svg 
        viewBox="0 0 100 100" 
        className="w-full h-full drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] transition-transform group-hover:scale-110"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Jersey Base (T-Shirt shape) */}
        <path 
          d="M25 15 L40 5 L60 5 L75 15 L95 40 L80 55 L75 45 L75 95 L25 95 L25 45 L20 55 L5 40 Z" 
          fill={finalBaseColor}
          stroke={finalTrimColor}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        
        {/* Collar trim */}
        <path d="M40 5 Q 50 15 60 5" stroke={finalTrimColor} strokeWidth="4" fill="none" />
        
        {/* Sleeve trims */}
        <line x1="20" y1="20" x2="35" y2="35" stroke={finalTrimColor} strokeWidth="2" />
        <line x1="80" y1="20" x2="65" y2="35" stroke={finalTrimColor} strokeWidth="2" />
        
        {/* Chest Initial / Branding */}
        <text 
          x="50" 
          y="40" 
          fontFamily="monospace" 
          fontSize="18" 
          fontWeight="900" 
          fill={finalTrimColor} 
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {initial}
        </text>

        {/* Big Squad Number on bottom half */}
        <text 
          x="50" 
          y="70" 
          fontFamily="sans-serif" 
          fontSize="26" 
          fontWeight="900" 
          fill="#ffffff" 
          textAnchor="middle"
          dominantBaseline="middle"
          opacity="0.9"
        >
          {backNumber}
        </text>
      </svg>
    </div>
  );
}
