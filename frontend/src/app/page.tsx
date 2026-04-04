import { api } from "@/lib/api";
import MatchCard from "@/components/MatchCard";
import { CalendarDays } from "lucide-react";
import LeaderboardSidebar from "@/components/LeaderboardSidebar";
import MatchCarousel from "@/components/MatchCarousel";
import RecentResults from "@/components/RecentResults";

export const revalidate = 60;

export default async function HomePage() {
  const [today, upcoming, leaders, recentResults] = await Promise.all([
    api.matches.today().catch(() => []),
    api.matches.upcoming(10, 7).catch(() => []),
    api.leaderboard.global(3).catch(() => []),
    api.matches.recentCompleted(5).catch(() => []),
  ]);
  const todayOpen = today.filter((m) => m.status !== "completed");
  const todayIds = new Set(today.map((m) => m.id));
  // Hero carousel: only matches you can still engage with (not settled today)
  const carouselMatches = [...todayOpen, ...upcoming.filter((m) => !todayIds.has(m.id))];

  if (carouselMatches.length === 0 && recentResults.length === 0) {
    return (
      <>
        <main className="max-w-5xl mx-auto px-6 py-20 flex flex-col items-center gap-3 text-center">
          <CalendarDays className="w-10 h-10 text-[var(--text-dim)]" />
          <p className="font-semibold">No upcoming matches</p>
          <p className="text-sm text-[var(--text-muted)]">Check back soon for the next fixture.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <div className="flex items-start">

        {/* ── Left sidebar: Upcoming matches ──────────────── */}
        {carouselMatches.length > 1 && (
          <aside className="hidden lg:block w-[380px] shrink-0 border-r border-[#262626] sticky top-14 h-[calc(100vh-56px)] overflow-y-auto">
            <div className="px-4 py-6">
              <SectionLabel>UPCOMING THIS WEEK</SectionLabel>
              <div className="mt-4 flex flex-col gap-3">
                {carouselMatches.slice(1).map((m) => (
                  <MatchCard key={m.id} match={m} variant="sidebar" />
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* ── Middle: Match Carousel + recent completed below ── */}
        <div className="flex-1 min-w-0 px-6 py-6 pb-14">
          {carouselMatches.length === 0 ? (
            <div className="border border-[#262626] bg-[#000000] px-6 py-12 text-center mb-6">
              <p className="font-semibold text-white">No upcoming matches right now</p>
              <p className="text-sm text-[var(--text-muted)] mt-2">Predictions open when the next fixture is listed.</p>
            </div>
          ) : (
            <MatchCarousel matches={carouselMatches} />
          )}
          {recentResults.length > 0 && (
            <div className={carouselMatches.length > 0 ? "mt-8" : ""}>
              <RecentResults matches={recentResults} />
            </div>
          )}
          
          {/* MOBILE ONLY: Rules & Tiers (Desktop handles this in Sidebar) */}
          <div className="flex flex-col gap-4 mt-8 lg:hidden">
            {/* Scoring Rules */}
            <div className="border border-[#262626] bg-[#000000] px-4 py-5 shrink-0">
              <p className="text-[10px] font-black tracking-[0.3em] text-[#737373] uppercase flex items-center gap-2 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-zap w-3.5 h-3.5 text-[#525252]"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
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
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-zap w-3.5 h-3.5 text-[#525252]"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
                Tier Legend
              </p>
              <div className="flex flex-col gap-1.5 relative z-10">
                {[
                  { tier: "God Mode",  color: "text-yellow-300", streak: "14+", mult: "×10" },
                  { tier: "Immortal",  color: "text-purple-400", streak: "7+",  mult: "×5"  },
                  { tier: "Five-fer",  color: "text-orange-400", streak: "5+",  mult: "×3"  },
                  { tier: "Hat-trick", color: "text-blue-400",   streak: "3+",  mult: "×2"  },
                  { tier: "In Form",   color: "text-green-400",  streak: "2+",  mult: "×1.5"},
                  { tier: "Debutant",  color: "text-[#525252]",  streak: "0+",  mult: "×1"  },
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
        </div>

        {/* ── Right sidebar: Live Leaderboard ────────────── */}
        <LeaderboardSidebar initialLeaders={leaders} />

      </div>
    </>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-[3px] h-5 bg-[#262626]" />
      <span className="text-[#525252] tracking-[0.25em] text-[13px] font-gaming uppercase">
        {children}
      </span>
      <div className="h-px flex-1 bg-[#262626]" />
    </div>
  );
}
