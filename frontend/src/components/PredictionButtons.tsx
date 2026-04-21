"use client";

import { useState, useEffect } from "react";
import { teamHex, teamFullName, teamShortCode, getPredictionState } from "@/lib/utils";
import { Lock, Zap, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import TeamCrest from "@/components/TeamCrest";

interface Props {
  matchId: string;
  team1: string;
  team2: string;
  tossTime: string;
  startTime?: string;
  matchStatus?: string;
  googleId: string | null;
  existingPrediction?: string | null;
  onRequireAuth: () => void;
  /** Keeps parent list in sync after submit / clear (optional). */
  onPredictionChange?: (selectedTeam: string | null) => void;
}

export default function PredictionButtons({
  matchId,
  team1,
  team2,
  tossTime,
  startTime,
  matchStatus,
  googleId,
  existingPrediction,
  onRequireAuth,
  onPredictionChange,
}: Props) {
  const [selected, setSelected] = useState<string | null>(existingPrediction ?? null);
  const [loading,  setLoading]  = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const predState = getPredictionState(tossTime, matchStatus, startTime);
  const locked = predState === "locked";
  const isPostToss = predState === "post_toss";

  useEffect(() => {
    setSelected(existingPrediction ?? null);
    setError(null);
  }, [existingPrediction, matchId]);

  async function clearPrediction() {
    if (!googleId) { onRequireAuth(); return; }
    if (locked || loading) return;
    setLoading("__clear__");
    setError(null);
    try {
      await api.predictions.remove(googleId, matchId);
      setSelected(null);
      onPredictionChange?.(null);
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      const networkish =
        /failed to fetch/i.test(raw) ||
        /load failed/i.test(raw) ||
        /networkerror/i.test(raw) ||
        /abort/i.test(raw);
      setError(
        networkish
          ? "Couldn’t reach the server. Check your connection and tap again."
          : raw || "Failed to clear prediction"
      );
    } finally {
      setLoading(null);
    }
  }

  async function predict(team: string) {
    if (!googleId) { onRequireAuth(); return; }
    if (locked || loading) return;
    if (selected === team) {
      await clearPrediction();
      return;
    }
    setLoading(team);
    setError(null);
    try {
      await api.predictions.submit(googleId, matchId, team);
      setSelected(team);
      onPredictionChange?.(team);
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      const networkish =
        /failed to fetch/i.test(raw) ||
        /load failed/i.test(raw) ||
        /networkerror/i.test(raw) ||
        /abort/i.test(raw);
      setError(
        networkish
          ? "Couldn’t reach the server. Check your connection and tap again."
          : raw || "Failed to save prediction"
      );
    } finally {
      setLoading(null);
    }
  }

  if (locked) {
    return (
      <div className="border-2 border-[#262626] bg-[#050505] p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Lock className="w-5 h-5 text-[#525252] shrink-0" />
          <div className="flex flex-col">
            <span className="text-[10px] text-[#525252] font-black uppercase tracking-[0.2em]">Match Started</span>
            <span className="text-lg sm:text-xl font-black text-white uppercase tracking-tighter mt-1">Predictions Locked</span>
          </div>
        </div>
        {selected && (
           <div className="flex items-center gap-3">
             <TeamCrest team={selected} size="sm" />
             <div className="flex flex-col items-start sm:items-end">
               <span className="text-[10px] text-[#525252] font-black uppercase tracking-[0.2em]">Your Pick</span>
               <span className="text-[10px] text-[#a3a3a3] font-black uppercase tracking-[0.15em] mt-1">{teamFullName(selected)}</span>
               <span className="text-xl sm:text-2xl uppercase tracking-widest" style={{ color: teamHex(selected), fontFamily: 'var(--font-heading)' }}>{teamShortCode(selected)}</span>
             </div>
           </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className="border-2 bg-[#050505] overflow-hidden relative transition-all duration-500"
      style={{ 
        borderColor: selected ? teamHex(selected) : '#ffffff',
        boxShadow: selected 
          ? `0 0 30px ${teamHex(selected)}30, 0 0 60px ${teamHex(selected)}10` 
          : '0 0 30px rgba(255,255,255,0.08), 0 0 60px rgba(255,255,255,0.03)'
      }}
    >
      {/* Massive Header */}
      <div className="px-6 py-5 border-b border-[#262626] flex items-center justify-between bg-[#000000]">
        <div className="flex items-center gap-4">
          {/* Glowing bolt — no plain background */}
          <div className="relative w-10 h-10 flex items-center justify-center shrink-0 border border-[#262626]">
            <Zap className="w-5 h-5" strokeWidth={1.5} style={{ color: '#c8c8c8' }} />
          </div>
          <div className="flex flex-col">
            <span className="font-gaming text-lg sm:text-xl font-black uppercase tracking-wide text-white">
              {selected ? (
                <>Backing{" "}
                  <span style={{ color: teamHex(selected) }}>{teamShortCode(selected)}</span>
                </>
              ) : "Pick Your Team"}
            </span>
            <span className="text-[10px] text-[#737373] font-black uppercase tracking-[0.2em] mt-0.5">
              {selected
                ? "Tap the other team to switch, or your pick again to clear"
                : "Who wins this match?"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isPostToss && (
            <span className="text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1.5 bg-[#f59e0b] text-black border border-[#f59e0b]">
              Post-Toss · 0.5×
            </span>
          )}
          {!selected && !isPostToss && (
            <div className="flex items-center gap-1.5 text-[#a3a3a3]">
              <span className="text-[9px] font-black uppercase tracking-[0.3em]">Pick</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>

      {/* Team Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2">
        {[team1, team2].map((team, idx) => {
          const isSelected = selected === team;
          const isLoading  = loading === team || (isSelected && loading === "__clear__");
          const hex = teamHex(team);

          return (
            <button
              key={team}
              onClick={() => predict(team)}
              disabled={!!loading}
              className={`relative flex items-center gap-5 p-6 sm:p-8 transition-all duration-300 overflow-hidden cursor-crosshair ${
                idx === 0 ? "border-b sm:border-b-0 sm:border-r border-[#262626]" : ""
              } ${loading ? "opacity-50 cursor-wait" : ""} group`}
              style={{ 
                backgroundColor: isSelected ? hex : '#111111',
              }}
            >
              {/* Hover border — animated inset outline in team color */}
              {!isSelected && (
                <div 
                  className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ boxShadow: `inset 0 0 0 2px ${hex}` }}
                />
              )}

              {/* Hover accent bar — slides in from left */}
              {!isSelected && (
                <div 
                  className="absolute left-0 top-0 w-1 h-full transition-all duration-300 opacity-0 group-hover:opacity-100 scale-y-0 group-hover:scale-y-100"
                  style={{ backgroundColor: hex, transformOrigin: 'center' }}
                />
              )}

              {/* Hover background glow */}
              {!isSelected && (
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: `linear-gradient(90deg, ${hex}10 0%, transparent 60%)` }}
                />
              )}

              {/* Team Crest — scales up on hover */}
              <div className="transition-transform duration-300 group-hover:scale-110 relative z-10">
                <TeamCrest team={team} size="md" inverted={isSelected} />
              </div>

              <div className="flex flex-col items-start gap-1 text-left flex-1 relative z-10 transition-transform duration-300 group-hover:translate-x-1">
                <span className={`text-[10px] uppercase tracking-[0.2em] font-black transition-colors duration-300 ${isSelected ? 'text-[#000000]/60' : 'text-[#a3a3a3] group-hover:text-[#c8c8c8]'}`}>
                  {teamFullName(team)}
                </span>
                <span className={`text-4xl sm:text-5xl tracking-widest transition-colors duration-300 ${isSelected ? 'text-[#000000]' : 'text-white'}`} style={{ fontFamily: 'var(--font-heading)' }}>
                  {isLoading ? "..." : teamShortCode(team)}
                </span>
              </div>
              
              {/* Vote indicator — glows on hover */}
              <div 
                className={`w-10 h-10 flex items-center justify-center shrink-0 border-2 transition-all duration-300 relative z-10 ${
                  isSelected 
                    ? 'border-[#000000] bg-[#000000]' 
                    : 'border-[#262626] bg-transparent group-hover:border-white/40 group-hover:scale-110'
                }`}
              >
                {isSelected 
                  ? <Zap className="w-5 h-5 text-white" fill="currentColor" />
                  : <ChevronRight className="w-4 h-4 text-[#737373] group-hover:text-white transition-all duration-300 group-hover:translate-x-0.5" />
                }
              </div>
            </button>
          );
        })}
      </div>



      {error && (
        <div className="px-6 py-3 border-t border-[#262626] bg-[#ef4444]/10">
          <p className="text-xs font-bold uppercase tracking-widest text-[#ef4444]">{error}</p>
        </div>
      )}

      {/* Mobile-only scoring rules — hidden on lg where sidebar shows them */}
      <div className="flex items-center justify-center gap-6 py-3 border-t border-[#262626] bg-[#0a0a0a] lg:hidden">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#10b981]" />
          <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#a3a3a3]">Pre-Toss</span>
          <span className="text-[10px] font-black text-white">×1</span>
        </div>
        <div className="w-px h-3 bg-[#262626]" />
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#f59e0b]" />
          <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#f59e0b]">Post-Toss</span>
          <span className="text-[10px] font-black text-[#f59e0b]">×0.5</span>
        </div>
      </div>
    </div>
  );
}
