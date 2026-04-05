"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MatchLiveResponse, MatchStatus } from "@/types";

type Props = {
  matchId: string;
  matchStatus: MatchStatus;
  cricapiId: string | null;
};

function formatOvers(o: unknown): string {
  if (o === null || o === undefined) return "—";
  const n = typeof o === "number" ? o : parseFloat(String(o));
  if (Number.isNaN(n)) return String(o);
  return `${n}`;
}

function partsFromScoreRow(row: Record<string, unknown>): {
  label: string;
  runs: string;
  wickets: string;
  overs: string;
} {
  const label = String(row.inning ?? "Innings").trim();
  const runs = String(row.r ?? row.runs ?? "—");
  const wickets = String(row.w ?? row.wickets ?? "—");
  const overs = formatOvers(row.o ?? row.overs);
  return { label, runs, wickets, overs };
}

export default function MatchScoreboard({ matchId, matchStatus, cricapiId }: Props) {
  const [live, setLive] = useState<MatchLiveResponse | null>(null);
  const [liveErr, setLiveErr] = useState(false);

  const loadLive = useCallback(() => {
    if (!cricapiId) return;
    api.matches
      .live(matchId)
      .then((d) => {
        setLive(d);
        setLiveErr(false);
      })
      .catch(() => setLiveErr(true));
  }, [matchId, cricapiId]);

  useEffect(() => {
    if (!cricapiId) return;
    loadLive();
  }, [matchId, cricapiId, loadLive, matchStatus]);

  useEffect(() => {
    if (!cricapiId) return;
    const feedLive =
      (live?.status === "live" && !live.match_ended) || (!live && matchStatus === "live");
    const intervalMs = feedLive ? 25_000 : matchStatus === "upcoming" ? 120_000 : 0;
    if (!intervalMs) return;
    const id = setInterval(loadLive, intervalMs);
    return () => clearInterval(id);
  }, [matchId, matchStatus, cricapiId, loadLive, live?.status, live?.match_ended]);

  if (!cricapiId) return null;

  const loadingLive = !live && !liveErr;
  const scores = live?.score ?? [];
  const statusLine = live?.status_text?.trim();
  const hasSummary = scores.length > 0 || Boolean(statusLine);
  const isLivePulse = matchStatus === "live" && !live?.match_ended;

  if (loadingLive) {
    return (
      <div
        className="relative overflow-hidden border border-[#1a1a1a] bg-black px-8 py-7 shadow-[0_0_80px_-20px_rgba(255,255,255,0.04)]"
        aria-busy
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="h-6 w-px bg-white/90 shrink-0" aria-hidden />
          <div className="h-2.5 w-16 bg-neutral-800 rounded-sm animate-pulse" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-[min(100%,20rem)] bg-neutral-900 rounded-sm animate-pulse" />
          <div className="h-8 w-[min(100%,14rem)] bg-neutral-900 rounded-sm animate-pulse" />
        </div>
        <span className="sr-only">Loading match score</span>
      </div>
    );
  }

  if (liveErr || (!hasSummary && matchStatus === "upcoming")) {
    return null;
  }

  return (
    <div className="relative overflow-hidden border border-[#1a1a1a] bg-black shadow-[0_0_80px_-20px_rgba(255,255,255,0.04)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent pointer-events-none" />

      <div className="px-8 py-7 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-6 w-px bg-white shrink-0" aria-hidden />
            <span className="text-[10px] font-semibold tracking-[0.35em] text-[#737373] uppercase font-sans">Score</span>
          </div>
          {isLivePulse && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-40" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[9px] font-bold tracking-[0.25em] text-emerald-500/95 uppercase font-sans">Live</span>
            </div>
          )}
        </div>

        {statusLine ? (
          <p className="text-[15px] sm:text-base leading-relaxed text-[#c8c8c8] font-sans font-normal tracking-tight -mt-2">
            {statusLine}
          </p>
        ) : null}

        {scores.length > 0 ? (
          <div className="flex flex-col gap-5">
            {scores.map((row, i) => {
              const { label, runs, wickets, overs } = partsFromScoreRow(row as Record<string, unknown>);
              return (
                <div
                  key={i}
                  className="group relative pl-4 -ml-4 border-l border-white/[0.08] hover:border-white/15 transition-colors duration-300"
                >
                  <p className="text-[11px] sm:text-xs text-[#737373] font-sans mb-2 uppercase tracking-[0.12em]">
                    {label}
                  </p>
                  <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                    <span
                      className="font-gaming text-[clamp(1.75rem,5vw,2.35rem)] font-black text-white tabular-nums tracking-tight leading-none"
                      style={{ textShadow: "0 0 40px rgba(255,255,255,0.06)" }}
                    >
                      {runs}
                      <span className="text-neutral-600 mx-1 font-black">/</span>
                      {wickets}
                    </span>
                    <span className="text-sm text-[#525252] font-sans tabular-nums pb-1 tracking-wide">
                      ({overs} ov)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
