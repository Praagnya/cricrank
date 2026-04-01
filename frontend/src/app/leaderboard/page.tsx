import { api } from "@/lib/api";
import Header from "@/components/Header";
import { Medal, Zap } from "lucide-react";
import { streakTierColor } from "@/lib/utils";
import { createClient } from "@/utils/supabase/server";
import CricketAvatar from "@/components/CricketAvatar";
import Link from "next/link";

const PERIOD_TABS = [
  { value: "alltime", label: "All Time" },
  { value: "weekly",  label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export const dynamic = "force-dynamic";
export const revalidate = 0;

const getAccuracyColor = (acc: number | null) => {
  if (acc == null) return "text-[#a3a3a3]";
  if (acc >= 75) return "text-[#10b981]";
  if (acc >= 50) return "text-[#f59e0b]";
  return "text-[#ef4444]";
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const providerId = user?.id;

  const p = await searchParams;
  const period = p.period || "alltime";

  const getStreakHeatColor = (streak: number) => {
    if (streak >= 6) return "#d71920";
    if (streak >= 4) return "#ea580c";
    if (streak >= 2) return "#f59e0b";
    return "#262626";
  };

  // Fetch leaderboard entries
  let allEntries = [];
  if (period === "weekly") {
    allEntries = await api.leaderboard.weekly(100).catch(() => []);
  } else if (period === "monthly") {
    allEntries = await api.leaderboard.monthly(100).catch(() => []);
  } else {
    allEntries = await api.leaderboard.global(100).catch(() => []);
  }

  const top10 = allEntries.slice(0, 10);

  let myEntry = allEntries.find((e) => e.google_id === providerId) ?? null;
  if (!myEntry && providerId) {
    myEntry = await api.leaderboard.myRank(providerId, period).catch(() => null);
  }
  const myRank = myEntry?.rank ?? null;

  const periodLabel = period === "weekly" ? "Last 7 Days"
    : period === "monthly" ? "Last 30 Days"
    : "All Time";

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-4 min-w-0">

        {/* Header Block */}
        <div className="border border-[#262626] bg-[#000000] p-5 sm:p-8 flex flex-col gap-4 overflow-hidden">
          {/* Title row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-5 min-w-0">
              <div className="relative w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center shrink-0 border border-[#262626]">
                <Medal className="w-5 h-5 sm:w-7 sm:h-7 relative z-10 text-white" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter text-white leading-none truncate">
                  Ranking
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#525252] mt-1 sm:mt-2 truncate">
                  {periodLabel} · Top {top10.length}
                </p>
              </div>
            </div>
          </div>

          {/* Period tabs */}
          <div className="flex items-center gap-2">
            {PERIOD_TABS.map(({ value, label }) => (
              <Link
                key={value}
                href={`/leaderboard?period=${value}`}
                className={`px-4 py-2 text-[10px] font-black tracking-[0.2em] uppercase border transition-colors ${
                  period === value
                    ? "border-white text-white bg-[#1a1a1a]"
                    : "border-[#262626] text-[#525252] hover:text-white hover:bg-[#111]"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {allEntries.length === 0 ? (
          <div className="border border-[#262626] bg-[#050505] p-16 flex flex-col items-center gap-4 text-center">
            <Medal className="w-8 h-8 mb-4 text-[#262626]" />
            <p className="font-black text-white text-xl uppercase tracking-widest">No Predictions Yet</p>
            <p className="text-[10px] text-[#525252] font-bold uppercase tracking-[0.2em]">Be the first to predict and claim the top spot.</p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium (Always show 3 slots for consistency) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {[top10[1], top10[0], top10[2]].map((entry, i) => {
                const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
                const medalColor = rank === 1 ? "#d4af37" : rank === 2 ? "#a3a3a3" : "#b08d57";
                
                // Render empty slot if no user exists for this rank
                if (!entry) {
                  return (
                    <div
                      key={`empty-podium-${i}`}
                      className="block min-h-[180px] sm:min-h-[320px] min-w-0 flex flex-col items-center justify-center border border-[#262626] bg-[#000000] p-3 sm:p-8 relative overflow-hidden opacity-50"
                    >
                      <div className="absolute top-0 left-0 w-full h-1 sm:h-1.5" style={{ backgroundColor: medalColor }} />
                      <span className="text-[9px] sm:text-xs font-black tracking-widest uppercase mb-2 sm:mb-6" style={{ color: medalColor }}>
                        {rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd"}
                      </span>
                      <div className="w-12 h-12 sm:w-28 sm:h-28 flex items-center justify-center mb-2 sm:mb-6 text-[#262626]">
                        —
                      </div>
                      <p className="font-gaming text-xs sm:text-2xl font-bold tracking-wide text-[#525252] truncate w-full text-center">
                        Empty Spot
                      </p>
                      <p className="text-xl sm:text-5xl font-black tracking-tighter text-[#525252] mt-2 sm:mt-4 mb-0.5 sm:mb-1">0</p>
                      <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.25em] text-[#262626]">Points</p>
                    </div>
                  );
                }

                const heatColor = getStreakHeatColor(entry.current_streak);
                const isMe = entry.google_id === providerId;

                return (
                  <Link
                    href={`/profile/${entry.username ?? entry.google_id}`}
                    key={`podium-${entry.google_id ?? i}`}
                    className={`block min-h-[180px] sm:min-h-[320px] min-w-0 flex flex-col items-center justify-center border p-3 sm:p-8 relative overflow-hidden transition-all duration-300 hover:brightness-125 hover:-translate-y-1 ${isMe ? 'bg-[#1a1a1a] border-white' : 'bg-[#050505] border-[#262626] hover:border-[#525252]'}`}
                  >
                    {/* Top Accent Strip */}
                    <div className="absolute top-0 left-0 w-full h-1 sm:h-1.5" style={{ backgroundColor: medalColor }} />
                    
                    {isMe && (
                      <div className="absolute top-3 right-3 text-[10px] font-black tracking-[0.2em] text-white bg-[#ffffff20] px-2 py-0.5 uppercase">
                        YOU
                      </div>
                    )}
                    
                    <span className="text-[9px] sm:text-xs font-black tracking-widest uppercase mb-2 sm:mb-6" style={{ color: medalColor }}>
                      {rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd"}
                    </span>
                    
                    <div 
                      className="w-12 h-12 sm:w-28 sm:h-28 flex items-center justify-center mb-2 sm:mb-6 relative z-10 group-hover:scale-110 transition-transform duration-300"
                      style={{ filter: heatColor !== '#262626' ? `drop-shadow(0 0 16px ${heatColor}90)` : 'none' }}
                    >
                      <CricketAvatar seed={entry.name ?? "A"} jerseyNumber={entry.jersey_number} jerseyColor={entry.jersey_color} />
                    </div>

                    <p className="font-gaming text-xs sm:text-2xl font-bold tracking-wide text-white truncate w-full text-center">
                      {entry.name ?? "Anonymous"}
                    </p>
                    
                    <p className="text-xl sm:text-5xl font-black tracking-tighter text-white mt-2 sm:mt-4 mb-0.5 sm:mb-1">{entry.points}</p>
                    <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.25em] text-[#525252]">Points</p>
                  </Link>
                );
              })}
            </div>

            {/* Full List View (Top 4 to 10) */}
            <div className="border border-[#262626] bg-[#000000] flex flex-col">
              {top10.slice(3).map((entry, idx) => {
                const rank = idx + 4;
                const heatColor = getStreakHeatColor(entry.current_streak);
                const isMe = entry.google_id === providerId;

                return (
                  <Link
                    href={`/profile/${entry.username ?? entry.google_id}`}
                    key={`list-${entry.google_id ?? idx}`}
                    className={`group flex items-center gap-3 sm:gap-6 px-4 sm:px-6 py-4 sm:py-5 border-b border-[#262626] last:border-0 transition-colors ${isMe ? 'bg-[#1a1a1a]' : 'hover:bg-[#0a0a0a]'}`}
                  >
                    {/* Rank */}
                    <span className="w-6 sm:w-12 text-left sm:text-center font-gaming text-lg sm:text-3xl font-black text-[#737373] shrink-0 group-hover:text-white transition-colors">
                      {rank}
                    </span>

                    {/* Avatar */}
                    <div 
                      className="hidden sm:flex w-12 h-12 items-center justify-center shrink-0 group hover:scale-110 transition-transform duration-300"
                      style={{ filter: heatColor !== '#262626' ? `drop-shadow(0 0 8px ${heatColor}80)` : 'none' }}
                    >
                      <CricketAvatar seed={entry.name ?? "A"} jerseyNumber={entry.jersey_number} jerseyColor={entry.jersey_color} />
                    </div>

                    {/* Name + Context */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-gaming text-sm sm:text-lg font-bold tracking-wide text-white truncate min-w-0">{entry.name ?? "Anonymous"}</p>
                        {isMe && <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.2em] bg-white text-black px-1.5 py-0.5">YOU</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                        <span className={`text-[9px] sm:text-[10px] font-black tracking-[0.2em] uppercase ${streakTierColor(entry.streak_tier)}`}>
                          {entry.streak_tier}
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-bold tracking-[0.2em] text-[#525252] uppercase">
                          {entry.correct_predictions}/{entry.settled_predictions} HITS
                        </span>
                      </div>
                    </div>

                    {/* Points + Accuracy */}
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p className="text-lg sm:text-2xl font-black text-white tabular-nums tracking-tighter leading-none">{entry.points}</p>
                      <div className="bg-[#111111] border border-[#262626] px-1.5 sm:px-2 py-0.5 mt-1 sm:mt-2 transition-colors group-hover:border-[#525252]">
                        <p className={`font-gaming text-[10px] sm:text-xs font-bold tracking-widest uppercase ${getAccuracyColor(entry.accuracy)}`}>
                          {entry.accuracy != null ? `${Math.round(entry.accuracy)}%` : "—"}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {myEntry && myRank && myRank > 10 && (
                <>
                  <div className="flex items-center justify-center py-2 sm:py-4">
                    <span className="text-[#525252] tracking-[1em] font-black text-2xl leading-none">...</span>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-6 px-4 sm:px-6 py-4 sm:py-5 border-2 border-white bg-[#1a1a1a]">
                    {/* Rank */}
                    <span className="w-6 sm:w-12 text-left sm:text-center font-gaming text-lg sm:text-3xl font-black text-white shrink-0">
                      {myRank}
                    </span>

                    {/* Avatar */}
                    <div className="hidden sm:flex w-12 h-12 items-center justify-center shrink-0 group hover:scale-110 transition-transform duration-300">
                      <CricketAvatar seed={myEntry.name ?? "A"} jerseyNumber={myEntry.jersey_number} jerseyColor={myEntry.jersey_color} />
                    </div>

                    {/* Name + Context */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-gaming text-sm sm:text-lg font-bold tracking-wide text-white truncate min-w-0">{myEntry.name ?? "Anonymous"}</p>
                        <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.2em] bg-white text-black px-1.5 py-0.5">YOU</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                        <span className={`text-[9px] sm:text-[10px] font-black tracking-[0.2em] uppercase ${streakTierColor(myEntry.streak_tier)}`}>
                          {myEntry.streak_tier}
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-bold tracking-[0.2em] text-[#525252] uppercase">
                          {myEntry.correct_predictions}/{myEntry.settled_predictions} HITS
                        </span>
                      </div>
                    </div>

                    {/* Points + Accuracy */}
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p className="text-lg sm:text-2xl font-black text-white tabular-nums tracking-tighter leading-none">{myEntry.points}</p>
                      <div className="bg-[#000000] border border-[#262626] px-1.5 sm:px-2 py-0.5 mt-1 sm:mt-2">
                        <p className={`font-gaming text-[10px] sm:text-xs font-bold tracking-widest uppercase ${getAccuracyColor(myEntry.accuracy)}`}>
                          {myEntry.accuracy != null ? `${Math.round(myEntry.accuracy)}%` : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* MOBILE ONLY: Rules & Tiers (Desktop handles this in Sidebar) */}
        <div className="flex flex-col gap-4 mt-8 lg:hidden">
          {/* Scoring Rules */}
          <div className="border border-[#262626] bg-[#000000] px-4 py-5 shrink-0">
            <p className="text-[10px] font-black tracking-[0.3em] text-[#737373] uppercase flex items-center gap-2 mb-4">
              <Zap className="w-3.5 h-3.5 text-[#525252]" />
              Scoring Rules
            </p>
            <div className="flex flex-col gap-0">
              <div className="flex items-center justify-between py-2.5 border-b border-[#111111]">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 bg-[#10b981]" />
                  <span className="text-xs font-black uppercase tracking-[0.15em] text-[#e5e5e5]">Pre-Toss</span>
                </div>
                <span className="text-[13px] font-black text-white bg-[#111111] px-2 py-0.5 border border-[#2a2a2a]">×1</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 bg-[#f59e0b]" />
                  <span className="text-xs font-black uppercase tracking-[0.15em] text-[#f59e0b]">Post-Toss</span>
                </div>
                <span className="text-[13px] font-black text-[#f59e0b] bg-[#111111] px-2 py-0.5 border border-[#2a2a2a]">×0.5</span>
              </div>
            </div>
          </div>

          {/* Tier Legend */}
          <div className="border border-[#262626] bg-[#000000] p-6 shrink-0 relative overflow-hidden group">
            <p className="text-[10px] font-black tracking-[0.3em] text-[#737373] uppercase flex items-center gap-2 mb-5">
              <Zap className="w-3.5 h-3.5 text-[#525252]" />
              Tier Legend
            </p>
            <div className="flex flex-col gap-1.5 relative z-10">
              {[
                { tier: "God Mode",     color: "text-yellow-300", streak: "14+", mult: "×10" },
                { tier: "Immortal",     color: "text-purple-400", streak: "7+",  mult: "×5"  },
                { tier: "Legend",       color: "text-orange-400", streak: "5+",  mult: "×3"  },
                { tier: "Veteran",      color: "text-blue-400",   streak: "3+",  mult: "×2"  },
                { tier: "Pro", color: "text-green-400",  streak: "2+",  mult: "×1.5"},
                { tier: "Rookie",       color: "text-[#525252]",  streak: "0+",  mult: "×1"  },
              ].map(({ tier, color, streak, mult }) => (
                <div key={tier} className="grid grid-cols-[135px_1fr_55px] sm:grid-cols-[180px_1fr_55px] items-center gap-3 py-1.5 border-b border-[#111111] last:border-0 hover:bg-[#111111] transition-colors -mx-3 px-3 cursor-default rounded-md">
                  <span className={`text-xs font-black uppercase tracking-[0.15em] ${color} truncate`}>{tier}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#c8c8c8] text-right w-6">{streak}</span>
                    <span className="text-[9px] uppercase font-bold text-[#525252] tracking-widest mt-0.5">streak</span>
                  </div>
                  <span className="text-[13px] font-black text-[#ffffff] text-center bg-[#111111] px-1.5 py-0.5 border border-[#2a2a2a] rounded shadow-sm">{mult}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </main>
    </>
  );
}
