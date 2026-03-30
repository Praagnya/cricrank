import { teamHex } from "@/lib/utils";

export default function TeamCrest({ team, size = "md", inverted = false }: { team: string; size?: "sm" | "md" | "lg"; inverted?: boolean }) {
  const hex = teamHex(team);
  // When inverted (on a team-colored background), use white for crisp visibility
  const stroke = inverted ? "rgba(255,255,255,0.85)" : hex;
  const textFill = inverted ? "#ffffff" : hex;
  const gradientId = inverted ? `glow-inv-${team}` : `glow-${team}`;

  const dims = size === "lg" ? "w-24 h-24" : size === "md" ? "w-16 h-16" : "w-12 h-12";
  const codeFontSize = size === "lg" ? "14" : size === "md" ? "11" : "9";

  return (
    <div className={`${dims} shrink-0 group`}>
      <svg viewBox="0 0 60 60" className="w-full h-full transition-transform duration-300 group-hover:scale-110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="40%" r="60%">
            {inverted ? (
              <>
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor={hex} stopOpacity="0.15" />
                <stop offset="100%" stopColor="#0a0a0a" stopOpacity="1" />
              </>
            )}
          </radialGradient>
        </defs>

        {/* Shield shape */}
        <path 
          d="M30 2 L55 12 L55 32 Q55 52 30 58 Q5 52 5 32 L5 12 Z" 
          fill={`url(#${gradientId})`}
          stroke={stroke} 
          strokeWidth="2"
        />
        
        {/* Inner outline */}
        <path 
          d="M30 7 L50 15 L50 31 Q50 48 30 53 Q10 48 10 31 L10 15 Z" 
          fill="none" 
          stroke={stroke} 
          strokeWidth="0.5" 
          opacity="0.35"
        />

        {/* Top chevron accent */}
        <path d="M22 14 L30 10 L38 14" stroke={stroke} strokeWidth="1.5" fill="none" opacity="0.8" />

        {/* Team Code — Centered and Bold */}
        <text 
          x="30" y="34" 
          fontFamily="monospace" 
          fontSize={codeFontSize}
          fontWeight="900" 
          fill={textFill} 
          textAnchor="middle" 
          dominantBaseline="middle"
          letterSpacing="2"
        >
          {team}
        </text>

        {/* Bottom accent line */}
        <line x1="20" y1="46" x2="40" y2="46" stroke={stroke} strokeWidth="1" opacity="0.4" />
      </svg>
    </div>
  );
}
