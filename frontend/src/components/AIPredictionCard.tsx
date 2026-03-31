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
  const leader = t1Prob >= t2Prob ? team1 : team2;

  return (
    <div className="border border-[#262626] bg-[#000000]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#262626] bg-[#0a0a0a]">
        <div className="flex items-center gap-3">
          <Bot className="w-4 h-4" style={{ color: '#a3a3a3' }} />
          <span className="tracking-[0.2em] text-[#c8c8c8] font-bold text-xs uppercase">
            AI Prediction
          </span>
        </div>
        <span className="tracking-[0.2em] text-[#737373] font-black text-[10px] uppercase">
          PredictXI
        </span>
      </div>

      <div className="px-4 sm:px-6 py-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 sm:gap-5 mb-2 items-start">
          <div className="text-left min-w-0">
            <p className="text-base sm:text-xl text-[#a3a3a3] font-bold tracking-[0.15em] uppercase mb-0" style={{ fontFamily: 'var(--font-heading)' }}>{teamShortCode(team1)}</p>
            <p className="text-[10px] text-[#737373] font-black tracking-[0.2em] uppercase min-h-[2.8rem] sm:min-h-[3.6rem]">{teamFullName(team1)}</p>
          </div>
          
          <div className="flex flex-col items-center justify-start px-1 shrink-0 pt-2">
            <span className="text-[#525252] font-black italic tracking-tighter text-xl sm:text-2xl lg:text-3xl leading-none">
              VS
            </span>
          </div>

          <div className="text-right min-w-0">
            <p className="text-base sm:text-xl text-[#a3a3a3] font-bold tracking-[0.15em] uppercase mb-0" style={{ fontFamily: 'var(--font-heading)' }}>{teamShortCode(team2)}</p>
            <p className="text-[10px] text-[#737373] font-black tracking-[0.2em] uppercase min-h-[2.8rem] sm:min-h-[3.6rem]">{teamFullName(team2)}</p>
          </div>
        </div>

        <div className="flex items-end justify-between mb-6">
          <span
            className="font-black tracking-tighter leading-none text-[40px] sm:text-[48px] lg:text-[56px]"
            style={{ color: t1hex }}
          >
            {t1Prob.toFixed(1)}%
          </span>
          <span
            className="font-black tracking-tighter leading-none text-[40px] sm:text-[48px] lg:text-[56px]"
            style={{ color: t2hex }}
          >
            {t2Prob.toFixed(1)}%
          </span>
        </div>

        {/* Dual-color block bar */}
        <div className="flex w-full h-3 mb-6 bg-[#111111]">
          <div className="h-full" style={{ width: `${t1Prob}%`, backgroundColor: t1hex }} />
          <div className="h-full" style={{ width: `${t2Prob}%`, backgroundColor: t2hex }} />
        </div>

        <div className="pt-2 border-t border-[#262626]">
          <p className="text-xs font-bold uppercase tracking-widest text-[#a3a3a3] mt-4">
            <span style={{ color: teamHex(leader) }}>{teamShortCode(leader)}</span> leads the AI model
          </p>
        </div>
      </div>
    </div>
  );
}
