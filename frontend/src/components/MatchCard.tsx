import { Match } from "@/types";
import { formatRelativeDate, teamHex, teamFullName } from "@/lib/utils";
import TeamCrest from "@/components/TeamCrest";

export default function MatchCard({ match, variant = "default" }: { match: Match, variant?: "default" | "sidebar" }) {
  const t1 = teamHex(match.team1);
  const t2 = teamHex(match.team2);

  if (variant === "sidebar") {
    return (
      <div className="group border border-[#1a1a1a] bg-[#111111] hover:bg-[#191919] transition-all duration-300 cursor-pointer relative overflow-hidden">
        {/* Team-color left accent — slides in on hover */}
        <div 
          className="absolute left-0 top-0 w-[3px] h-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: `linear-gradient(to bottom, ${t1}, ${t2})` }} 
        />


        <div className="px-5 py-3.5 flex items-center justify-between gap-3">
          {/* Teams */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-gaming text-lg font-bold tracking-wide text-white">
              {match.team1}
            </span>
            <span className="text-xs font-black tracking-[0.15em] text-[#525252]">vs</span>
            <span className="font-gaming text-lg font-bold tracking-wide text-white">
              {match.team2}
            </span>
          </div>
          <StatusChip status={match.status} />
        </div>
        
        <div className="px-5 pb-3.5 pt-0 flex items-center justify-between">
          <p className="text-xs text-[#525252] group-hover:text-[#737373] font-bold tracking-[0.2em] uppercase transition-colors duration-300">
            {formatRelativeDate(match.start_time)}
          </p>

        </div>
      </div>
    );
  }

  return (
    <div className="group border border-[#262626] bg-[#000000] hover:bg-[#050505] transition-all duration-300 cursor-pointer relative overflow-hidden">
      {/* Dual-team gradient wash at the top */}
      <div className="flex h-1.5">
        <div className="flex-1" style={{ backgroundColor: t1 }} />
        <div className="flex-1" style={{ backgroundColor: t2 }} />
      </div>

      <div className="p-5 sm:p-6">
        {/* Main Versus Layout */}
        <div className="flex items-center justify-center gap-4 sm:gap-8">
          {/* Team 1 Block */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamCrest team={match.team1} size="lg" />
            <p className="font-gaming text-sm sm:text-base font-bold tracking-wide text-white text-center">{match.team1}</p>
            <p className="text-[9px] font-bold tracking-[0.2em] text-[#a3a3a3] uppercase">{teamFullName(match.team1)}</p>
          </div>

          {/* VS Divider */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="relative w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center">
              {/* Diagonal slash background */}
              <svg viewBox="0 0 60 60" className="absolute inset-0 w-full h-full" fill="none">
                <line x1="0" y1="60" x2="60" y2="0" stroke="#262626" strokeWidth="1" />
                <line x1="5" y1="60" x2="60" y2="5" stroke="#262626" strokeWidth="0.5" opacity="0.5" />
                <line x1="0" y1="55" x2="55" y2="0" stroke="#262626" strokeWidth="0.5" opacity="0.5" />
              </svg>
              <span className="relative z-10 font-gaming text-xl sm:text-2xl font-black text-[#737373] tracking-[0.3em]">VS</span>
            </div>
          </div>

          {/* Team 2 Block */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamCrest team={match.team2} size="lg" />
            <p className="font-gaming text-sm sm:text-base font-bold tracking-wide text-white text-center">{match.team2}</p>
            <p className="text-[9px] font-bold tracking-[0.2em] text-[#a3a3a3] uppercase">{teamFullName(match.team2)}</p>
          </div>
        </div>

        {/* Bottom Metadata Strip */}
        <div className="mt-6 pt-4 border-t border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[9px] font-black tracking-[0.2em] text-[#737373] uppercase">Venue</span>
              <span className="font-gaming text-xs font-bold text-[#c8c8c8] tracking-wide mt-0.5">{match.venue.split(",")[0]}</span>
            </div>
            <div className="h-6 w-px bg-[#262626] hidden sm:block" />
            <div className="flex flex-col">
              <span className="text-[9px] font-black tracking-[0.2em] text-[#737373] uppercase">Schedule</span>
              <span className="font-gaming text-xs font-bold text-[#c8c8c8] tracking-wide mt-0.5">{formatRelativeDate(match.start_time)}</span>
            </div>
          </div>
          <StatusChip status={match.status} />
        </div>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "live") {
    return (
      <span className="text-[10px] inline-flex items-center gap-2 px-3 py-1.5 font-black uppercase tracking-widest bg-[#000000] text-[#10b981] border border-[#10b981]">
        <span className="w-1.5 h-1.5 bg-[#10b981] animate-pulse" />
        Live
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="text-[10px] inline-block px-3 py-1.5 font-black uppercase tracking-widest bg-[#111111] text-[#a3a3a3] border border-[#262626]">
        Done
      </span>
    );
  }
  return null;
}
