import { Match } from "@/types";
import { teamShortCode, formatShortDate } from "@/lib/utils";

export default function RecentResults({ matches }: { matches: Match[] }) {
  if (!matches.length) return null;

  return (
    <div className="border border-[#262626] bg-[#000000] px-4 py-5 sm:px-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-[3px] h-5 bg-[#262626]" />
        <span className="text-[#a3a3a3] tracking-[0.25em] text-[13px] font-gaming uppercase">Recent results</span>
        <div className="h-px flex-1 bg-[#262626]" />
      </div>
      <ul className="flex flex-col gap-4">
        {matches.map((m) => {
          const summary =
            m.result_summary?.trim() ||
            (m.status === "completed" && m.winner ? `${m.winner} won` : null);
          return (
            <li key={m.id} className="flex flex-col gap-1.5 border-b border-[#1a1a1a] last:border-0 pb-4 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-white min-w-0">
                  <span className="font-gaming text-sm font-bold">{teamShortCode(m.team1)}</span>
                  <span className="text-[#525252] text-xs">vs</span>
                  <span className="font-gaming text-sm font-bold">{teamShortCode(m.team2)}</span>
                </div>
                <span className="text-[10px] font-bold tracking-[0.15em] text-[#525252] shrink-0 tabular-nums">
                  {formatShortDate(m.start_time)}
                </span>
              </div>
              {summary && <p className="text-sm text-[#a3a3a3]">{summary}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
