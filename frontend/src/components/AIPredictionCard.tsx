import { AIPrediction } from "@/types";
import { Bot } from "lucide-react";
import { teamFullName, teamHex, teamShortCode } from "@/lib/utils";

export default function AIPredictionCard({
  prediction, team1, team2,
}: {
  prediction: AIPrediction;
  team1: string;
  team2: string;
}) {
  const isT1Winner = prediction.predicted_winner === team1;
  const t1Prob = isT1Winner ? prediction.win_probability : prediction.opponent_probability;
  const t2Prob = isT1Winner ? prediction.opponent_probability : prediction.win_probability;
  const t1hex = teamHex(team1);
  const t2hex = teamHex(team2);

  return (
    <div className="border border-[#262626] bg-[#000000]">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#262626] bg-[#0a0a0a]">
        <Bot className="w-4 h-4" style={{ color: '#a3a3a3' }} />
        <span className="tracking-[0.2em] text-[#c8c8c8] font-bold text-xs uppercase">
          AI Prediction
        </span>
      </div>

      <div className="px-6 py-6">
        {/* Big probability numbers */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-left">
            <p className="text-xl text-[#a3a3a3] font-bold tracking-[0.15em] uppercase mb-0" style={{ fontFamily: 'var(--font-heading)' }}>{teamShortCode(team1)}</p>
            <p className="text-[10px] text-[#737373] font-black tracking-[0.2em] uppercase">{teamFullName(team1)}</p>
            <span
              className="font-black tracking-tighter"
              style={{ fontSize: "48px", color: t1hex }}
            >
              {t1Prob.toFixed(1)}%
            </span>
          </div>
          
          <div className="flex flex-col items-center justify-center pt-4">
            <span className="text-[#525252] font-black italic tracking-tighter text-3xl">
              VS
            </span>
          </div>

          <div className="text-right">
            <p className="text-xl text-[#a3a3a3] font-bold tracking-[0.15em] uppercase mb-0" style={{ fontFamily: 'var(--font-heading)' }}>{teamShortCode(team2)}</p>
            <p className="text-[10px] text-[#737373] font-black tracking-[0.2em] uppercase">{teamFullName(team2)}</p>
            <span
              className="font-black tracking-tighter"
              style={{ fontSize: "48px", color: t2hex }}
            >
              {t2Prob.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Dual-color block bar */}
        <div className="flex w-full h-3 bg-[#111111]">
          <div className="h-full" style={{ width: `${t1Prob}%`, backgroundColor: t1hex }} />
          <div className="h-full" style={{ width: `${t2Prob}%`, backgroundColor: t2hex }} />
        </div>
      </div>
    </div>
  );
}
