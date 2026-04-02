"use client";

import { Challenge, ChallengeStatus } from "@/types";
import { teamHex, teamShortCode, formatRelativeDate } from "@/lib/utils";
import TeamCrest from "@/components/TeamCrest";
import { Clock, CheckCircle, XCircle, RefreshCw, Trophy } from "lucide-react";

const STATUS: Record<ChallengeStatus, { label: string; color: string; Icon: React.ElementType }> = {
  open:            { label: "Open",          color: "text-[#f59e0b]",  Icon: Clock },
  accepted:        { label: "Accepted",      color: "text-[#10b981]",  Icon: CheckCircle },
  counter_offered: { label: "Counter",       color: "text-[#8b5cf6]",  Icon: RefreshCw },
  declined:        { label: "Declined",      color: "text-[#ef4444]",  Icon: XCircle },
  expired:         { label: "Expired",       color: "text-[#525252]",  Icon: Clock },
  cancelled:       { label: "Cancelled",     color: "text-[#525252]",  Icon: XCircle },
  settled:         { label: "Settled",       color: "text-[#10b981]",  Icon: Trophy },
};

interface Props {
  challenge: Challenge;
  viewerGoogleId?: string;
}

export default function ChallengeCard({ challenge, viewerGoogleId }: Props) {
  const { match, challenger, acceptor, status } = challenge;
  const t1hex = teamHex(match.team1);
  const t2hex = teamHex(match.team2);
  const challengerHex = teamHex(challenge.challenger_team);
  const opponentTeam = match.team1 === challenge.challenger_team ? match.team2 : match.team1;
  const { label, color, Icon } = STATUS[status];

  const isChallenger = viewerGoogleId && challenger.google_id === viewerGoogleId;

  return (
    <div className="border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
      {/* Top color bar */}
      <div className="h-[2px]" style={{ background: `linear-gradient(to right, ${t1hex}, ${t2hex})` }} />

      <div className="px-3 py-2.5">
        {/* Row 1: match info + status */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <TeamCrest team={match.team1} size="sm" />
            <span className="text-[9px] font-black text-[#333]">vs</span>
            <TeamCrest team={match.team2} size="sm" />
            <div className="ml-1 min-w-0">
              <p className="text-[11px] font-bold text-white leading-tight truncate">
                {teamShortCode(match.team1)} vs {teamShortCode(match.team2)}
              </p>
              <p className="text-[9px] text-[#525252]">{formatRelativeDate(match.start_time)}</p>
            </div>
          </div>
          <div className={`flex items-center gap-1 shrink-0 ml-2 ${color}`}>
            <Icon className="w-3 h-3" strokeWidth={2} />
            <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
          </div>
        </div>

        {/* Row 2: stakes */}
        <div className="flex items-center justify-between bg-[#111] border border-[#1a1a1a] px-3 py-2">
          {/* Challenger */}
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[8px] font-black text-white shrink-0"
              style={{ background: challengerHex }}>
              {teamShortCode(challenge.challenger_team)}
            </div>
            <p className="text-[9px] text-white font-bold truncate max-w-[64px] text-center">
              {isChallenger ? "You" : challenger.name.split(" ")[0]}
            </p>
            <div className="flex items-center gap-0.5">
              <span className="text-[9px] text-[#f59e0b]">◈</span>
              <span className="text-sm font-black text-white tabular-nums">{challenge.challenger_stake}</span>
            </div>
          </div>

          {/* Pot */}
          <div className="flex flex-col items-center px-2">
            <p className="text-[8px] text-[#525252] uppercase tracking-widest mb-0.5">pot</p>
            <div className="flex items-center gap-0.5">
              <span className="text-[#f59e0b] text-xs">◈</span>
              <span className="text-base font-black text-white tabular-nums">{challenge.challenger_wants}</span>
            </div>
          </div>

          {/* Acceptor */}
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[8px] font-black border shrink-0"
              style={{
                background: acceptor ? teamHex(opponentTeam) : "transparent",
                borderColor: acceptor ? teamHex(opponentTeam) : "#262626",
                color: acceptor ? "white" : "#525252",
              }}>
              {acceptor ? teamShortCode(opponentTeam) : "?"}
            </div>
            <p className="text-[9px] text-white font-bold truncate max-w-[64px] text-center">
              {acceptor ? acceptor.name.split(" ")[0] : "Open"}
            </p>
            <div className="flex items-center gap-0.5">
              <span className="text-[9px] text-[#f59e0b]">◈</span>
              <span className="text-sm font-black text-white tabular-nums">{challenge.acceptor_stake}</span>
            </div>
          </div>
        </div>

        {/* Counter offer pill */}
        {status === "counter_offered" && challenge.counter_challenger_stake != null && (
          <div className="mt-2 flex items-center gap-2 bg-[#1a0a2e] border border-[#3b1f6e] px-2.5 py-1.5">
            <RefreshCw className="w-3 h-3 text-[#8b5cf6] shrink-0" />
            <p className="text-[9px] text-[#8b5cf6]">
              Counter: ◈{challenge.counter_challenger_stake} stake · ◈{challenge.counter_challenger_wants} pot
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
