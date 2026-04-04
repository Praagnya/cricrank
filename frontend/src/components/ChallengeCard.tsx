"use client";

import { Challenge, ChallengeStatus } from "@/types";
import { teamHex, teamShortCode, formatRelativeDate } from "@/lib/utils";
import TeamCrest from "@/components/TeamCrest";
import { Clock, CheckCircle, XCircle, RefreshCw, Trophy } from "lucide-react";

const STATUS: Record<ChallengeStatus, { label: string; color: string; Icon: React.ElementType }> = {
  open:            { label: "Open",          color: "text-[#f59e0b]",  Icon: Clock },
  accepted:        { label: "Accepted",      color: "text-[#10b981]",  Icon: CheckCircle },
  counter_offered: { label: "Counter",       color: "text-[#8b5cf6]",  Icon: RefreshCw },
  declined:        { label: "Declined",      color: "text-[#525252]",  Icon: XCircle },
  expired:         { label: "Expired",       color: "text-[#525252]",  Icon: Clock },
  cancelled:       { label: "Cancelled",     color: "text-[#525252]",  Icon: XCircle },
  settled:         { label: "Settled",       color: "text-[#10b981]",  Icon: Trophy },
};

export const TERMINAL_STATUSES: ChallengeStatus[] = ["settled", "expired", "declined", "cancelled"];

interface Props {
  challenge: Challenge;
  viewerGoogleId?: string;
  compact?: boolean;
}

export default function ChallengeCard({ challenge, viewerGoogleId, compact = false }: Props) {
  const { match, challenger, acceptor, status } = challenge;
  const t1hex = teamHex(match.team1);
  const t2hex = teamHex(match.team2);
  const challengerHex = teamHex(challenge.challenger_team);
  const opponentTeam = match.team1 === challenge.challenger_team ? match.team2 : match.team1;
  const { label, color, Icon } = STATUS[status];

  const isChallenger = viewerGoogleId && challenger.google_id === viewerGoogleId;
  const viewerTeam = isChallenger ? challenge.challenger_team : opponentTeam;
  const viewerStake = isChallenger ? challenge.challenger_stake : challenge.acceptor_stake;

  const viewerTeamWon = status === "settled" && match.winner
    ? match.winner === viewerTeam
    : null;

  // ── Compact (ledger) row ──────────────────────────────────────────────────
  if (compact) {
    const outcomeColor =
      status === "settled"
        ? viewerTeamWon ? "text-[#10b981]" : "text-[#ef4444]"
        : "text-[#525252]";

    const outcomeText =
      status === "settled"
        ? viewerTeamWon
          ? `+◈${challenge.challenger_wants}`
          : `-◈${viewerStake}`
        : status === "expired" || status === "cancelled" || status === "declined"
          ? isChallenger ? `◈${challenge.challenger_stake} back` : "—"
          : "—";

    return (
      <div className="flex items-center gap-3 px-3 py-2.5 border border-[#1a1a1a] bg-[#000000]">
        <div className="w-[2px] h-8 shrink-0" style={{ background: teamHex(viewerTeam) }} />
        <div className="flex-1 min-w-0">
          <p className="font-gaming text-[11px] font-bold text-white leading-tight tracking-wide">
            {teamShortCode(match.team1)} vs {teamShortCode(match.team2)}
          </p>
          <p className="text-[9px] font-bold tracking-[0.15em] text-[#525252] uppercase mt-0.5">
            Backed <span style={{ color: teamHex(viewerTeam) }}>{teamShortCode(viewerTeam)}</span>
            {" · "}{new Date(match.start_time).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <div className={`flex items-center gap-1 ${color}`}>
            <Icon className="w-3 h-3" strokeWidth={2} />
            <span className="font-gaming text-[9px] font-black uppercase tracking-widest">{label}</span>
          </div>
          <span className={`font-gaming text-[11px] font-black tabular-nums ${outcomeColor}`}>{outcomeText}</span>
        </div>
      </div>
    );
  }

  // ── Full card ─────────────────────────────────────────────────────────────
  return (
    <div className="border border-[#262626] bg-[#000000] overflow-hidden">
      {/* Top color bar */}
      <div className="h-[2px]" style={{ background: `linear-gradient(to right, ${t1hex}, ${t2hex})` }} />

      <div className="px-3 py-2.5">
        {/* Row 1: match info + status */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <TeamCrest team={match.team1} size="sm" />
            <span className="text-[9px] font-black text-[#333]">vs</span>
            <TeamCrest team={match.team2} size="sm" />
            <div className="ml-1 min-w-0">
              <p className="font-gaming text-xs font-bold tracking-wide text-white leading-tight truncate">
                {teamShortCode(match.team1)} vs {teamShortCode(match.team2)}
              </p>
              <p className="text-[9px] font-bold tracking-[0.15em] text-[#525252] uppercase mt-0.5">
                {formatRelativeDate(match.start_time)}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-1 shrink-0 ml-2 ${color}`}>
            <Icon className="w-3.5 h-3.5" strokeWidth={2} />
            <span className="font-gaming text-[10px] font-black uppercase tracking-widest">{label}</span>
          </div>
        </div>

        {/* Row 2: stakes */}
        <div className="flex items-center justify-between bg-[#0a0a0a] border border-[#262626] px-3 py-2.5">
          {/* Challenger */}
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className="w-7 h-7 flex items-center justify-center text-[8px] font-black text-white shrink-0"
              style={{ background: challengerHex }}>
              {teamShortCode(challenge.challenger_team)}
            </div>
            <p className="font-gaming text-[10px] font-bold tracking-wide text-white truncate max-w-[64px] text-center">
              {isChallenger ? "You" : challenger.name.split(" ")[0]}
            </p>
            <div className="flex items-center gap-0.5">
              <span className="text-[10px] text-[#f59e0b]">◈</span>
              <span className="font-gaming text-base font-black text-white tabular-nums">{challenge.challenger_stake}</span>
            </div>
          </div>

          {/* Pot */}
          <div className="flex flex-col items-center px-2">
            <p className="font-gaming text-[9px] font-black text-[#525252] uppercase tracking-[0.2em] mb-0.5">pot</p>
            <div className="flex items-center gap-0.5">
              <span className="text-[#f59e0b] text-sm">◈</span>
              <span className="font-gaming text-lg font-black text-white tabular-nums">{challenge.challenger_wants}</span>
            </div>
          </div>

          {/* Acceptor */}
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className="w-7 h-7 flex items-center justify-center text-[8px] font-black border shrink-0"
              style={{
                background: acceptor ? teamHex(opponentTeam) : "transparent",
                borderColor: acceptor ? teamHex(opponentTeam) : "#262626",
                color: acceptor ? "white" : "#525252",
              }}>
              {acceptor ? teamShortCode(opponentTeam) : "?"}
            </div>
            <p className="font-gaming text-[10px] font-bold tracking-wide text-white truncate max-w-[64px] text-center">
              {acceptor ? acceptor.name.split(" ")[0] : "Open"}
            </p>
            <div className="flex items-center gap-0.5">
              <span className="text-[10px] text-[#f59e0b]">◈</span>
              <span className="font-gaming text-base font-black text-white tabular-nums">{challenge.acceptor_stake}</span>
            </div>
          </div>
        </div>

        {/* Counter offer */}
        {status === "counter_offered" && challenge.counter_challenger_stake != null && (
          <div className="mt-2 flex items-center gap-2 bg-[#1a0a2e] border border-[#3b1f6e] px-2.5 py-1.5">
            <RefreshCw className="w-3 h-3 text-[#8b5cf6] shrink-0" />
            <p className="font-gaming text-[9px] text-[#8b5cf6] tracking-wide">
              Counter: ◈{challenge.counter_challenger_stake} stake · ◈{challenge.counter_challenger_wants} pot
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
