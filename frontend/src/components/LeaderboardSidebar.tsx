"use client";

import { useEffect, useState } from "react";
import { LeaderboardEntry } from "@/types";
import { streakTierColor } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/api-base";
import { Zap, Medal } from "lucide-react";
import CricketAvatar from "@/components/CricketAvatar";
import { createClient } from "@/utils/supabase/client";

const BASE = getApiBaseUrl();

type Period = "alltime" | "weekly" | "monthly";

async function fetchLeaders(period: Period, limit: number): Promise<LeaderboardEntry[]> {
  const endpoint = period === "weekly" ? "weekly" : period === "monthly" ? "monthly" : "global";
  const res = await fetch(`${BASE}/leaderboard/${endpoint}?limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export default function LeaderboardSidebar({ initialLeaders }: { initialLeaders: LeaderboardEntry[] }) {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>(initialLeaders);
  const [period, setPeriod] = useState<Period>("alltime");
  const [pulse, setPulse] = useState(false);
  const [providerId, setProviderId] = useState<string | null>(null);

  // Get logged-in user
  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setProviderId(user.user_metadata?.provider_id || user.id);
      }
    };
    getUser();
  }, []);

  // Fetch on period change + auto-refresh
  useEffect(() => {
    const load = async () => {
      const fresh = await fetchLeaders(period, 100);
      if (fresh.length > 0) {
        setLeaders(fresh);
        setPulse(true);
        setTimeout(() => setPulse(false), 600);
      }
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [period]);

  const top3 = leaders.slice(0, 3);

  // Find user in the full list
  const myIndex = providerId ? leaders.findIndex(e => e.google_id === providerId) : -1;
  const myEntry = myIndex >= 0 ? leaders[myIndex] : null;
  const myRank = myIndex >= 0 ? myIndex + 1 : null;

  const tabs: { label: string; value: Period }[] = [
    { label: "All", value: "alltime" },
    { label: "Week", value: "weekly" },
    { label: "Month", value: "monthly" },
  ];

  return (
    <aside className="hidden lg:block w-[380px] shrink-0 border-l border-[#262626] sticky top-14 h-[calc(100vh-56px)] overflow-y-auto">
      <div className="px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
              <span className="absolute inset-0 rounded-full border" style={{ borderColor: 'rgba(251,191,36,0.25)' }} />
              <Medal className="w-4 h-4 relative z-10 text-white" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#a3a3a3]">
              Leaderboard
            </span>
            <div className="h-px flex-1 bg-[#262626]" />
          </div>
          <span
            className={`w-2 h-2 rounded-full bg-emerald-400 shrink-0 transition-opacity ${pulse ? "opacity-100" : "opacity-60"}`}
            style={{ animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" }}
          />
        </div>

        {/* Period Tabs */}
        <div className="flex border border-[#262626] mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setPeriod(tab.value)}
              className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] transition-colors ${
                period === tab.value
                  ? "bg-white text-black"
                  : "bg-[#111111] text-[#525252] hover:text-[#a3a3a3] hover:bg-[#1a1a1a]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {leaders.length === 0 ? (
          <div className="border border-[#262626] bg-[#050505] p-8 text-center flex flex-col items-center">
            <Medal className="w-5 h-5 text-[#3a3a3a] mb-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a3a3a3]">No leaders yet</p>
          </div>
        ) : (
          <div className="border border-[#262626] bg-[#000000] flex flex-col">
            {top3.map((entry, i) => {
              const rank = i + 1;
              const isFirst = rank === 1;
              const rankColor =
                rank === 1 ? "text-[#d4af37]" :
                rank === 2 ? "text-[#a3a3a3]" :
                rank === 3 ? "text-[#b08d57]" :
                "text-[#525252]";
                
              return (
                <div
                  key={entry.google_id ?? String(i)}
                  className={`flex items-center gap-3 px-4 py-3.5 border-b border-[#1a1a1a] bg-[#0d0d0d] hover:bg-[#171717] ${isFirst ? "bg-[#151515]" : ""} relative transition-colors cursor-pointer`}
                >
                  {isFirst && <div className="absolute top-0 left-0 w-1 h-full bg-[#d4af37]" />}
                  
                  {/* Rank */}
                  <span className={`w-6 text-center font-gaming text-lg font-black ${rankColor}`}>
                    {rank}
                  </span>
                  
                  {/* Cricket Jersey Avatar */}
                  <div className="w-9 h-9 shrink-0 group">
                    <CricketAvatar seed={entry.name ?? "A"} jerseyColor={entry.jersey_color} jerseyNumber={entry.jersey_number} />
                  </div>
                  
                  {/* Name + Streak */}
                  <div className="flex-1 min-w-0">
                    <p className="font-gaming text-sm font-bold tracking-wide text-white truncate">{entry.name ?? "Anonymous"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] uppercase tracking-[0.15em] font-black ${streakTierColor(entry.streak_tier)}`}>
                        {entry.streak_tier}
                      </span>
                    </div>
                  </div>
                  
                  {/* Points */}
                  <span className="font-black text-white text-lg tabular-nums tracking-tighter">
                    {entry.points}
                  </span>
                </div>
              );
            })}

            {/* Your Rank Row */}
            {myEntry && myRank && myRank > 3 && (
              <>
                <div className="flex items-center justify-center py-1.5 border-b border-[#262626]">
                  <span className="text-[#3a3a3a] tracking-[0.5em] font-black text-sm">···</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[#262626] bg-[#0a0a0a] relative">
                  <div className="absolute top-0 left-0 w-1 h-full bg-white" />
                  <span className="w-6 text-center font-gaming text-lg font-black text-white">
                    {myRank}
                  </span>
                  <div className="w-9 h-9 shrink-0 group">
                    <CricketAvatar seed={myEntry.name ?? "A"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-gaming text-sm font-bold tracking-wide text-white truncate">{myEntry.name ?? "Anonymous"}</p>
                      <span className="text-[9px] font-black uppercase tracking-[0.15em] bg-white text-black px-1 py-px">YOU</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] uppercase tracking-[0.15em] font-black ${streakTierColor(myEntry.streak_tier)}`}>
                        {myEntry.streak_tier}
                      </span>
                    </div>
                  </div>
                  <span className="font-black text-white text-lg tabular-nums tracking-tighter">
                    {myEntry.points}
                  </span>
                </div>
              </>
            )}

            <a
              href="/leaderboard"
              className="flex items-center justify-center gap-2 py-4 text-xs font-black tracking-[0.25em] text-[#a3a3a3] uppercase bg-[#111111] hover:bg-[#1a1a1a] hover:text-white transition-colors border-t border-[#262626]"
            >
              <Medal className="w-3 h-3 text-[#a3a3a3]" />
              Full Leaderboard
            </a>

          </div>
        )}
      </div>

      {/* ── Scoring Rules — between leaderboard and tier legend ── */}
      <div className="border-t border-[#262626] bg-[#000000] px-4 py-5">
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

      {/* ── Tier Legend ── */}
      <div className="border-t border-[#262626] bg-[#000000] p-6 relative overflow-hidden group">
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
            <div key={tier} className="grid grid-cols-[135px_1fr_55px] items-center gap-3 py-1.5 border-b border-[#111111] last:border-0 hover:bg-[#111111] transition-colors -mx-3 px-3 cursor-default rounded-md">
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
    </aside>
  );
}
