"use client";

import { Challenge, ChallengeStatus } from "@/types";
import { teamHex, teamShortCode, formatRelativeDate } from "@/lib/utils";
import TeamCrest from "@/components/TeamCrest";
import { Clock, CheckCircle, XCircle, Handshake, RefreshCw, Trophy } from "lucide-react";

const STATUS_LABEL: Record<ChallengeStatus, { label: string; color: string; Icon: React.ElementType }> = {
  open:            { label: "Waiting",        color: "text-[#f59e0b]",  Icon: Clock },
  accepted:        { label: "Accepted",       color: "text-[#10b981]",  Icon: CheckCircle },
  counter_offered: { label: "Counter Offer",  color: "text-[#8b5cf6]",  Icon: RefreshCw },
  declined:        { label: "Declined",       color: "text-[#ef4444]",  Icon: XCircle },
  expired:         { label: "Expired",        color: "text-[#525252]",  Icon: Clock },
  cancelled:       { label: "Cancelled",      color: "text-[#525252]",  Icon: XCircle },
  settled:         { label: "Settled",        color: "text-[#10b981]",  Icon: Trophy },
};

interface ChallengeCardProps {
  challenge: Challenge;
  viewerGoogleId?: string;
  onAction?: () => void;
}

export default function ChallengeCard({ challenge, viewerGoogleId, onAction }: ChallengeCardProps) {
  const { match, challenger, acceptor, status } = challenge;
  const t1hex = teamHex(match.team1);
  const t2hex = teamHex(match.team2);
  const challengerHex = teamHex(challenge.challenger_team);

  const statusMeta = STATUS_LABEL[status];
  const StatusIcon = statusMeta.Icon;

  const isChallenger = viewerGoogleId && challenger.google_id === viewerGoogleId;
  const isAcceptor = viewerGoogleId && acceptor?.google_id === viewerGoogleId;

  const opponentTeam = match.team1 === challenge.challenger_team ? match.team2 : match.team1;

  return (
    <div className="border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden relative">
      {/* Color accent top bar */}
      <div
        className="h-[3px] w-full"
        style={{ background: `linear-gradient(to right, ${t1hex}, ${t2hex})` }}
      />

      <div className="p-4">
        {/* Match info + status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <TeamCrest team={match.team1} size="sm" />
            <span className="text-[10px] font-black text-[#525252] tracking-widest">vs</span>
            <TeamCrest team={match.team2} size="sm" />
            <div className="ml-2 min-w-0">
              <p className="text-[11px] font-bold text-white leading-tight truncate">
                {teamShortCode(match.team1)} vs {teamShortCode(match.team2)}
              </p>
              <p className="text-[10px] text-[#525252]">{formatRelativeDate(match.start_time)}</p>
            </div>
          </div>
          <div className={`flex items-center gap-1 shrink-0 ${statusMeta.color}`}>
            <StatusIcon className="w-3.5 h-3.5" strokeWidth={2} />
            <span className="text-[10px] font-black uppercase tracking-widest">{statusMeta.label}</span>
          </div>
        </div>

        {/* Stakes breakdown */}
        <div className="bg-[#111111] border border-[#1a1a1a] p-3 mb-3">
          <div className="flex items-center justify-between">
            {/* Challenger side */}
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black text-white"
                style={{ background: challengerHex }}
              >
                {teamShortCode(challenge.challenger_team)}
              </div>
              <p className="text-[10px] font-bold text-white">{challenger.name.split(" ")[0]}</p>
              <p className="text-[9px] text-[#525252]">backs {teamShortCode(challenge.challenger_team)}</p>
              <div className="flex items-center gap-0.5">
                <span className="text-[10px] text-[#f59e0b]">◈</span>
                <span className="text-sm font-black text-white">{challenge.challenger_stake}</span>
              </div>
            </div>

            {/* Center */}
            <div className="flex flex-col items-center gap-1">
              <Handshake className="w-5 h-5 text-[#262626]" />
              <div className="text-center">
                <p className="text-[9px] text-[#525252]">pot</p>
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-[#f59e0b]">◈</span>
                  <span className="text-base font-black text-white">{challenge.challenger_wants}</span>
                </div>
              </div>
            </div>

            {/* Acceptor side */}
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black text-white bg-[#1a1a1a] border border-[#262626]"
              >
                {acceptor ? teamShortCode(opponentTeam) : "?"}
              </div>
              <p className="text-[10px] font-bold text-white">
                {acceptor ? acceptor.name.split(" ")[0] : "Open"}
              </p>
              <p className="text-[9px] text-[#525252]">backs {teamShortCode(opponentTeam)}</p>
              <div className="flex items-center gap-0.5">
                <span className="text-[10px] text-[#f59e0b]">◈</span>
                <span className="text-sm font-black text-white">{challenge.acceptor_stake}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Counter offer details */}
        {status === "counter_offered" && challenge.counter_challenger_stake != null && (
          <div className="bg-[#1a0a2e] border border-[#3b1f6e] p-2.5 mb-3">
            <p className="text-[10px] text-[#8b5cf6] font-bold mb-1">Counter Offer</p>
            <div className="flex gap-4 text-[11px]">
              <span className="text-[#a3a3a3]">
                Challenger puts: <span className="text-white font-bold">◈{challenge.counter_challenger_stake}</span>
              </span>
              <span className="text-[#a3a3a3]">
                Winner gets: <span className="text-white font-bold">◈{challenge.counter_challenger_wants}</span>
              </span>
            </div>
          </div>
        )}

        {/* Action hint */}
        {onAction && (
          <button
            onClick={onAction}
            className="w-full text-[11px] font-black text-[#a3a3a3] hover:text-white uppercase tracking-widest py-1.5 border border-[#1a1a1a] hover:border-[#333] transition-colors"
          >
            View Details
          </button>
        )}
      </div>
    </div>
  );
}
