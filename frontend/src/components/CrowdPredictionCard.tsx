import { CrowdPrediction } from "@/types";
import { Users } from "lucide-react";
import { teamHex, teamShortCode } from "@/lib/utils";

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
          <Users className="w-4 h-4 text-[#a3a3a3]" />
          <span className="font-gaming text-[11px] font-black uppercase tracking-[0.25em] text-white">
            Crowd Vote
          </span>
        </div>
        <span className="font-gaming text-[11px] font-black uppercase tracking-[0.2em] text-[#737373]">
          {totalVotes.toLocaleString()} Votes
        </span>
      </div>

      <div className="px-4 sm:px-6 py-5">
        {/* Teams + percentages */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-5">
          {/* Team 1 */}
          <div className="flex flex-col gap-1">
            <p className="tracking-widest leading-none" style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(28px, 5vw, 42px)", color: t1hex }}>
              {teamShortCode(team1)}
            </p>
            <p className="font-gaming text-[32px] sm:text-[40px] font-black tracking-tighter leading-none" style={{ color: t1hex }}>
              {t1Pct.toFixed(1)}%
            </p>
          </div>

          {/* VS */}
          <div className="flex items-center justify-center px-2">
            <span className="font-gaming text-xl font-black text-[#525252] tracking-[0.3em]">VS</span>
          </div>

          {/* Team 2 */}
          <div className="flex flex-col items-end gap-1">
            <p className="tracking-widest leading-none" style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(28px, 5vw, 42px)", color: t2hex }}>
              {teamShortCode(team2)}
            </p>
            <p className="font-gaming text-[32px] sm:text-[40px] font-black tracking-tighter leading-none" style={{ color: t2hex }}>
              {t2Pct.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Dual-color bar */}
        <div className="flex w-full h-3 mb-4 bg-[#111111]">
          <div className="h-full" style={{ width: `${t1Pct}%`, backgroundColor: t1hex }} />
          <div className="h-full" style={{ width: `${t2Pct}%`, backgroundColor: t2hex }} />
        </div>

        {/* Leader line */}
        {totalVotes > 0 && (
          <div className="pt-3 border-t border-[#262626]">
            <p className="font-gaming text-[10px] font-black uppercase tracking-[0.2em] text-[#737373]">
              <span style={{ color: teamHex(leader) }}>{teamShortCode(leader)}</span> leads the crowd
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
