"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, LogIn, X, Copy, Check, Users } from "lucide-react";
import { Squad } from "@/types";
import { getApiBaseUrl } from "@/lib/api-base";

interface Props {
  period: string;
  squadId: string | null;
  squads: Squad[];
  providerId: string | null;
}

const SQUAD_SUGGESTIONS = ["Dream XI", "Home Ground", "Office XI", "Champions", "Work Gang", "Super Over"];

export default function LeaderboardDropdown({ period, squadId, squads, providerId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<"create" | "join" | null>(null);
  const [squadName, setSquadName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const activeLabel = squadId
    ? (squads.find((s) => s.id === squadId)?.name ?? "Squad")
    : period === "following" ? "Following"
    : "Groups";

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const handleCreate = async () => {
    if (!providerId || !squadName.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`${getApiBaseUrl()}/squads/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ google_id: providerId, name: squadName.trim() }),
      });
      if (res.status === 400) { setError((await res.json()).detail); return; }
      const squad: Squad = await res.json();
      setModal(null); setSquadName("");
      router.push(`/leaderboard?squad=${squad.id}`);
      router.refresh();
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  };

  const handleJoin = async () => {
    if (!providerId || !inviteCode.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/squads/join/${inviteCode.trim().toUpperCase()}?google_id=${providerId}`,
        { method: "POST" }
      );
      if (!res.ok) { setError((await res.json()).detail); return; }
      const squad: Squad = await res.json();
      setModal(null); setInviteCode("");
      router.push(`/leaderboard?squad=${squad.id}`);
      router.refresh();
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <>
      {/* Dropdown trigger */}
      <div className="relative self-start sm:self-auto">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 border border-[#262626] bg-[#050505] hover:bg-[#111] transition-colors px-4 py-2.5 w-full sm:w-auto"
        >
          <span className="text-[10px] font-black tracking-[0.2em] uppercase text-white">{activeLabel}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-[#525252] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-[190]" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-52 bg-[#0a0a0a] border border-[#262626] shadow-2xl z-[200]">
              {/* Following */}
              <button
                onClick={() => navigate(`/leaderboard?period=following`)}
                className={`w-full text-left px-4 py-2.5 text-[10px] font-black tracking-[0.2em] uppercase transition-colors flex items-center gap-2 ${
                  !squadId && period === "following" ? "text-white bg-[#1a1a1a]" : "text-[#525252] hover:text-white hover:bg-[#111]"
                }`}
              >
                <Users className="w-3 h-3 shrink-0" /> Following
              </button>

              {/* Squads section */}
              {squads.length > 0 && (
                <>
                  <div className="border-t border-[#1a1a1a] mt-1 pt-1">
                    <p className="px-4 py-1.5 text-[8px] font-black tracking-[0.3em] uppercase text-[#333]">My Squads</p>
                    {squads.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => navigate(`/leaderboard?squad=${s.id}`)}
                        className={`w-full text-left px-4 py-2.5 text-[10px] font-black tracking-[0.15em] uppercase transition-colors flex items-center gap-2 ${
                          squadId === s.id ? "text-white bg-[#1a1a1a]" : "text-[#525252] hover:text-white hover:bg-[#111]"
                        }`}
                      >
                        <Users className="w-3 h-3 shrink-0" />
                        <span className="truncate">{s.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyCode(s.invite_code); }}
                          className="ml-auto shrink-0 text-[#333] hover:text-[#fbbf24] transition-colors"
                          title="Copy invite code"
                        >
                          {copied === s.invite_code ? <Check className="w-3 h-3 text-[#10b981]" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Create / Join */}
              {providerId && (
                <div className="border-t border-[#1a1a1a] mt-1 pt-1 pb-1">
                  <button
                    onClick={() => { setOpen(false); setModal("create"); setError(""); }}
                    className="w-full text-left px-4 py-2.5 text-[10px] font-black tracking-[0.2em] uppercase text-[#525252] hover:text-white hover:bg-[#111] transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-3 h-3" /> Create Squad
                  </button>
                  <button
                    onClick={() => { setOpen(false); setModal("join"); setError(""); }}
                    className="w-full text-left px-4 py-2.5 text-[10px] font-black tracking-[0.2em] uppercase text-[#525252] hover:text-white hover:bg-[#111] transition-colors flex items-center gap-2"
                  >
                    <LogIn className="w-3 h-3" /> Join Squad
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Create / Join Modal */}
      {modal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0a0a0a] border border-[#262626] w-full max-w-sm p-6 relative">
            <button onClick={() => setModal(null)} className="absolute top-4 right-4 text-[#737373] hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <h2 className="font-gaming text-xl tracking-widest mb-6 uppercase">
              {modal === "create" ? "Create Squad" : "Join Squad"}
            </h2>

            {modal === "create" ? (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {SQUAD_SUGGESTIONS.map((n) => (
                    <button
                      key={n}
                      onClick={() => { setSquadName(n); setError(""); }}
                      className={`px-3 py-1.5 text-[9px] font-black tracking-widest uppercase border transition-colors ${squadName === n ? "border-white text-white bg-[#1a1a1a]" : "border-[#333] text-[#525252] hover:border-[#555] hover:text-white"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <label className="block text-[#737373] text-[10px] font-black tracking-[0.2em] mb-2 uppercase">Squad Name</label>
                <input
                  type="text"
                  maxLength={30}
                  value={squadName}
                  onChange={(e) => { setSquadName(e.target.value); setError(""); }}
                  placeholder="e.g. Work Friends"
                  className="w-full bg-[#111] border border-[#333] text-white font-gaming px-4 py-3 text-lg focus:outline-none focus:border-white transition-colors placeholder:text-[#444] mb-1"
                />
                <div className="flex justify-between mb-6">
                  {error ? <p className="text-[9px] text-[#ef4444] font-bold tracking-widest uppercase">{error}</p> : <span />}
                  <p className="text-[9px] text-[#525252]">{squadName.length}/30</p>
                </div>
                <button
                  onClick={handleCreate}
                  disabled={loading || !squadName.trim()}
                  className="w-full py-3 bg-white text-black font-gaming tracking-widest hover:bg-[#c8c8c8] disabled:opacity-50 transition-colors uppercase"
                >
                  {loading ? "Creating..." : "Create"}
                </button>
              </>
            ) : (
              <>
                <label className="block text-[#737373] text-[10px] font-black tracking-[0.2em] mb-2 uppercase">Invite Code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={inviteCode}
                  onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setError(""); }}
                  placeholder="ABC123"
                  className="w-full bg-[#111] border border-[#333] text-white font-gaming px-4 py-3 text-2xl tracking-widest text-center focus:outline-none focus:border-white transition-colors placeholder:text-[#444] mb-1"
                />
                {error && <p className="text-[9px] text-[#ef4444] font-bold tracking-widest uppercase mb-4">{error}</p>}
                <div className="mb-6" />
                <button
                  onClick={handleJoin}
                  disabled={loading || inviteCode.length < 6}
                  className="w-full py-3 bg-white text-black font-gaming tracking-widest hover:bg-[#c8c8c8] disabled:opacity-50 transition-colors uppercase"
                >
                  {loading ? "Joining..." : "Join"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
