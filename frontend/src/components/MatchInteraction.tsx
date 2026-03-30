"use client";

import { useUser } from "@/hooks/useUser";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import PredictionButtons from "./PredictionButtons";
import { LogIn, TrendingUp, Zap } from "lucide-react";

interface Props {
  matchId: string;
  team1: string;
  team2: string;
  tossTime: string;
  startTime?: string;
  matchStatus?: string;
}

export default function MatchInteraction({ matchId, team1, team2, tossTime, startTime, matchStatus }: Props) {
  const { user, loading, signInWithGoogle } = useUser();
  const [existingPrediction, setExistingPrediction] = useState<string | null>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const googleId = user?.id ?? null;

  useEffect(() => {
    if (!googleId) return;
    api.predictions
      .byUser(googleId)
      .then((preds) => {
        const found = preds.find(
          (p: { match_id: string; selected_team: string }) => p.match_id === matchId
        );
        if (found) setExistingPrediction(found.selected_team);
      })
      .catch(() => null);
  }, [googleId, matchId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex gap-3 animate-pulse">
          <div className="h-10 flex-1 bg-[var(--surface-2)] rounded-xl" />
          <div className="h-10 flex-1 bg-[var(--surface-2)] rounded-xl" />
        </div>
      </div>
    );
  }

  if (showAuthPrompt || (!user && !loading)) {
    return (
      <div 
        className="border-2 border-white bg-[#050505] overflow-hidden"
        style={{ boxShadow: '0 0 30px rgba(255,255,255,0.08), 0 0 60px rgba(255,255,255,0.03)' }}
      >
        <div className="px-6 py-5 border-b border-[#262626] bg-[#000000] flex items-center gap-4">
          <div className="w-10 h-10 flex items-center justify-center shrink-0 border border-[#262626]">
            <Zap className="w-5 h-5 text-white" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col">
            <span className="font-gaming text-lg sm:text-xl font-black text-white uppercase tracking-wide">
              Make Your Pick
            </span>
            <span className="text-[10px] text-[#525252] font-black uppercase tracking-[0.2em] mt-0.5">
              Sign in to lock your choice and climb ranks
            </span>
          </div>
        </div>
        
        <div className="p-8 flex items-center justify-center">
          <button
             onClick={signInWithGoogle}
             className="px-8 py-4 bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-[#e5e5e5] transition-colors shrink-0 flex items-center gap-3"
             style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
          >
            <LogIn className="w-5 h-5" />
            Sign in to Predict
          </button>
        </div>
      </div>
    );
  }

  return (
    <PredictionButtons
      matchId={matchId}
      team1={team1}
      team2={team2}
      tossTime={tossTime}
      startTime={startTime}
      matchStatus={matchStatus}
      googleId={googleId}
      existingPrediction={existingPrediction}
      onRequireAuth={() => setShowAuthPrompt(true)}
    />
  );
}
