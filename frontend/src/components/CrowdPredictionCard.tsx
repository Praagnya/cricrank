import { CrowdPrediction } from "@/types";
import { Users } from "lucide-react";
import { teamFullName, teamHex, teamShortCode } from "@/lib/utils";

export default function CrowdPredictionCard({
  crowd, team1, team2,
}: {
  crowd: CrowdPrediction;
  team1: string;
  team2: string;
}) {
  const t1Pct = crowd[team1] ?? 50;
  const t2Pct = crowd[team2] ?? 50;
  const totalVotes = crowd.total_votes ?? 0;
  const t1hex = teamHex(team1);
  const t2hex = teamHex(team2);
  const leader = t1Pct >= t2Pct ? team1 : team2;

  return (
    <div className="border border-[#262626] bg-[#000000]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#262626] bg-[#0a0a0a]">
        <div className="flex items-center gap-3">
          <Users className="w-4 h-4" style={{ color: '#a3a3a3' }} />
          <span className="tracking-[0.2em] text-[#c8c8c8] font-bold text-xs uppercase">
            Crowd Vote
          </span>
        </div>
        <span className="tracking-[0.2em] text-[#737373] font-black text-[10px] uppercase">
          {totalVotes.toLocaleString()} Votes
        </span>
      </div>

      <div className="px-4 sm:px-6 py-6">
        {/* Big percentage numbers */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-5 mb-6">
          <div className="text-left min-w-0">
            <p className="text-base sm:text-xl text-[#a3a3a3] font-bold tracking-[0.15em] uppercase mb-0" style={{ fontFamily: 'var(--font-heading)' }}>{teamShortCode(team1)}</p>
            <p className="text-[10px] text-[#737373] font-black tracking-[0.2em] uppercase">{teamFullName(team1)}</p>
            <span
              className="block font-black tracking-tighter leading-none text-[44px] sm:text-[52px] lg:text-[64px] whitespace-nowrap"
              style={{ color: t1hex }}
            >
              {t1Pct.toFixed(1)}%
            </span>
          </div>
          
          <div className="flex flex-col items-center justify-center px-1 shrink-0">
            <span className="text-[#525252] font-black italic tracking-tighter text-2xl sm:text-3xl lg:text-4xl leading-none">
              VS
            </span>
          </div>

          <div className="text-right min-w-0">
            <p className="text-base sm:text-xl text-[#a3a3a3] font-bold tracking-[0.15em] uppercase mb-0" style={{ fontFamily: 'var(--font-heading)' }}>{teamShortCode(team2)}</p>
            <p className="text-[10px] text-[#737373] font-black tracking-[0.2em] uppercase">{teamFullName(team2)}</p>
            <span
              className="block font-black tracking-tighter leading-none text-[44px] sm:text-[52px] lg:text-[64px] whitespace-nowrap"
              style={{ color: t2hex }}
            >
              {t2Pct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Dual-color block bar */}
        <div className="flex w-full h-3 mb-6 bg-[#111111]">
          <div className="h-full" style={{ width: `${t1Pct}%`, backgroundColor: t1hex }} />
          <div className="h-full" style={{ width: `${t2Pct}%`, backgroundColor: t2hex }} />
        </div>

        {/* Leader line */}
        {totalVotes > 0 && (
          <div className="pt-2 border-t border-[#262626]">
            <p className="text-xs font-bold uppercase tracking-widest text-[#a3a3a3] mt-4">
              <span style={{ color: teamHex(leader) }}>{teamShortCode(leader)}</span> leads the crowd
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
