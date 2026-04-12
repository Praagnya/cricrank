"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MatchLiveResponse, MatchScorecardResponse, MatchStatus } from "@/types";
import { statusLooksInProgressChase } from "@/lib/utils";

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

function playerName(node: unknown): string {
  if (node && typeof node === "object" && "name" in node && typeof (node as { name: unknown }).name === "string") {
    return (node as { name: string }).name;
  }
  return "—";
}

function battingStrikeRate(b: Record<string, unknown>): string {
  const raw = b.sr;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw.toFixed(1);
  if (typeof raw === "string" && raw.trim()) {
    const p = parseFloat(raw);
    if (Number.isFinite(p)) return p.toFixed(1);
  }
  const r = typeof b.r === "number" ? b.r : parseFloat(String(b.r ?? "NaN"));
  const balls = typeof b.b === "number" ? b.b : parseInt(String(b.b ?? "0"), 10);
  if (!Number.isFinite(r) || !Number.isFinite(balls) || balls < 0) return "—";
  if (balls === 0) return "—";
  return ((r / balls) * 100).toFixed(1);
}

function dismissalSubline(dismissal: unknown): string | null {
  const s = String(dismissal ?? "").trim();
  if (!s) return null;
  const dt = typeof dismissal === "object" && dismissal && "dismissal-text" in dismissal
    ? String((dismissal as { "dismissal-text": unknown })["dismissal-text"] ?? "").trim()
    : "";
  if (dt) return dt;
  if (/^not out$/i.test(s)) return null;
  if (/^batting$/i.test(s)) return null;
  if (s === "—" || s === "-") return null;
  return s;
}

function showNotOutAsterisk(dismissal: unknown): boolean {
  const s = String(dismissal ?? "").trim();
  if (/^did not bat$/i.test(s)) return false;
  if (!s || s === "—" || s === "-") return true;
  if (/^not out$/i.test(s) || /^batting$/i.test(s)) return true;
  return false;
}

export default function MatchScoreboard({ matchId, matchStatus, cricapiId }: Props) {
  const [live, setLive] = useState<MatchLiveResponse | null>(null);
  const [liveErr, setLiveErr] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<MatchScorecardResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState(false);

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

  const loadDetail = useCallback(() => {
    if (!cricapiId) return;
    setDetailLoading(true);
    setDetailErr(false);
    api.matches
      .scorecard(matchId)
      .then((d) => setDetail(d))
      .catch(() => setDetailErr(true))
      .finally(() => setDetailLoading(false));
  }, [matchId, cricapiId]);

  useEffect(() => {
    if (!expanded || detail || detailLoading) return;
    if (detailErr) return;
    loadDetail();
  }, [expanded, detail, detailLoading, detailErr, loadDetail]);

  if (!cricapiId) return null;

  const loadingLive = !live && !liveErr;
  const scores = live?.score ?? [];
  /** Prefer final lines when the API marks the match ended but status_text is still a chase equation. */
  const statusLine = (() => {
    if (!live) return undefined;
    const t = live.status_text?.trim() || null;
    const ended = live.match_ended || live.status === "completed";
    const w = live.match_winner?.trim() || null;
    const rs = live.result_summary?.trim() || null;
    if (ended && w) {
      if (rs && !statusLooksInProgressChase(rs)) return rs;
      if (t && !statusLooksInProgressChase(t)) return t;
      return `${w} won`;
    }
    return t ?? undefined;
  })();
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

  const scorecardRows = detail?.scorecard ?? [];
  const hasBattingTables = scorecardRows.some((inn) => {
    const batting = (inn as { batting?: unknown[] }).batting;
    return Array.isArray(batting) && batting.length > 0;
  });

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

        <button
          type="button"
          onClick={() => {
            setExpanded((prev) => {
              const next = !prev;
              if (next && detailErr) {
                setDetailErr(false);
                setDetail(null);
              }
              return next;
            });
          }}
          className="group flex items-center gap-2.5 text-left -mx-1 px-1 py-1.5 rounded-sm hover:bg-white/[0.03] transition-colors cursor-pointer w-fit"
        >
          <span className="text-[#525252] group-hover:text-[#737373] font-sans text-xs transition-colors" aria-hidden>
            {expanded ? "⌄" : "›"}
          </span>
          <span className="text-[10px] font-semibold tracking-[0.28em] uppercase text-[#5c5c5c] group-hover:text-[#8a8a8a] font-sans transition-colors">
            {expanded ? "Hide scorecard" : "Full scorecard"}
          </span>
        </button>

        {expanded && (
          <div className="pt-2 space-y-5 border-t border-white/[0.06]">
            {detailLoading && (
              <p className="text-[10px] font-semibold tracking-[0.2em] text-[#525252] uppercase font-sans animate-pulse">
                Loading…
              </p>
            )}
            {detailErr && (
              <p className="text-[13px] text-[#737373] font-sans leading-relaxed">
                Batting details are not available for this match yet.
              </p>
            )}
            {!detailLoading && !detailErr && !hasBattingTables && (
              <p className="text-[13px] text-[#737373] font-sans leading-relaxed">
                {isLivePulse
                  ? "Full batting lines usually appear after a few overs — the summary above updates from the live feed."
                  : "No detailed batting card yet — line scores above follow the live feed."}
              </p>
            )}
            {scorecardRows.map((inn, idx) => {
              const batting = (inn as { batting?: Record<string, unknown>[] }).batting ?? [];
              if (!batting.length) return null;
              return (
                <div key={idx} className="rounded-sm bg-[#050505] border border-white/[0.04] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                    <p className="text-[9px] font-bold tracking-[0.22em] text-[#5c5c5c] uppercase font-sans">
                      {(inn as { inning?: string }).inning?.trim() || `Innings ${idx + 1}`}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12px] border-collapse font-sans min-w-[260px]">
                      <thead>
                        <tr className="text-[#525252] border-b border-white/[0.06]">
                          <th className="py-2.5 pl-4 pr-3 font-semibold text-[10px] uppercase tracking-[0.15em]">Batter</th>
                          <th className="py-2.5 px-2 font-semibold text-[10px] uppercase tracking-wider text-right w-11">R</th>
                          <th className="py-2.5 px-2 font-semibold text-[10px] uppercase tracking-wider text-right w-11">B</th>
                          <th className="py-2.5 pr-4 pl-2 font-semibold text-[10px] uppercase tracking-wider text-right w-14">SR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batting.map((b, j) => {
                          const row = b as Record<string, unknown>;
                          const outLine = dismissalSubline(row["dismissal-text"] ?? row.dismissal);
                          return (
                            <tr
                              key={j}
                              className="border-b border-white/[0.04] text-[#d4d4d4] hover:bg-white/[0.02] transition-colors"
                            >
                              <td className="py-2.5 pl-4 pr-3 align-top">
                                <div className="text-[13px] text-white font-medium leading-snug">
                                  {playerName(row.batsman)}
                                  {showNotOutAsterisk(row.dismissal) ? (
                                    <span className="font-semibold" aria-label="not out">
                                      *
                                    </span>
                                  ) : null}
                                </div>
                                {outLine ? (
                                  <p className="mt-1 text-[10px] leading-relaxed text-[#737373] font-normal max-w-[min(100%,14rem)]">
                                    {outLine}
                                  </p>
                                ) : null}
                              </td>
                              <td className="py-2.5 px-2 text-right tabular-nums font-medium text-white align-top">
                                {String(row.r ?? "—")}
                              </td>
                              <td className="py-2.5 px-2 text-right tabular-nums text-[#a3a3a3] align-top">
                                {String(row.b ?? "—")}
                              </td>
                              <td className="py-2.5 pr-4 pl-2 text-right tabular-nums text-[#c8c8c8] align-top">
                                {battingStrikeRate(row)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
