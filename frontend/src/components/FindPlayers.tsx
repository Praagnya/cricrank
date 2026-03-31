"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { FollowUser } from "@/types";
import CricketAvatar from "./CricketAvatar";
import { streakTierColor } from "@/lib/utils";

interface FindPlayersProps {
  onClose: () => void;
}

export default function FindPlayers({ onClose }: FindPlayersProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.users.search(query.trim());
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[64px] bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[#0a0a0a] border border-[#262626] shadow-2xl mx-4 mt-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center border-b border-[#1a1a1a]">
          <Search className="w-4 h-4 text-[#525252] ml-4 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players by name or @username..."
            className="flex-1 bg-transparent text-white px-4 py-4 text-sm font-bold tracking-wide focus:outline-none placeholder:text-[#444]"
          />
          <button onClick={onClose} className="p-4 text-[#525252] hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        {query.trim() && (
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8 text-[#525252] text-[10px] font-black tracking-[0.3em] uppercase animate-pulse">
                Searching...
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-8 text-[#525252] text-[10px] font-black tracking-[0.2em] uppercase">
                No players found
              </div>
            ) : (
              results.map((u) => (
                <Link
                  key={u.google_id}
                  href={`/profile/${u.username ?? u.google_id}`}
                  onClick={onClose}
                  className="flex items-center gap-4 px-4 py-3 border-b border-[#111] hover:bg-[#111] transition-colors"
                >
                  <div className="w-10 h-10 shrink-0">
                    <CricketAvatar seed={u.name} jerseyNumber={u.jersey_number} jerseyColor={u.jersey_color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-gaming text-sm tracking-wide text-white truncate">{u.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {u.username && (
                        <span className="text-[9px] font-mono text-[#525252]">@{u.username}</span>
                      )}
                      <span className={`text-[9px] font-black tracking-widest uppercase ${streakTierColor(u.streak_tier)}`}>
                        {u.streak_tier}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-black text-white">{u.points}</p>
                    <p className="text-[8px] text-[#525252] font-bold uppercase tracking-widest">pts</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
