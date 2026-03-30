"use client";

import Link from "next/link";
import { Trophy, LogOut, LogIn, Zap, Menu, X, Home } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api-base";

export default function Header() {
  const { user, loading, signInWithGoogle, signOut } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [coins, setCoins] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { setCoins(null); return; }
    fetch(`${getApiBaseUrl()}/users/${user.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setCoins(data.coins); })
      .catch(() => {});
  }, [user]);

  // Shared button class for all header buttons
  const btn = "flex items-center justify-center border border-[#262626] bg-[#0a0a0a] hover:bg-[#1a1a1a] transition-colors rounded text-white";

  return (
    <>
      <header className="sticky top-0 z-50 bg-[#000000] border-b border-[#262626] select-none">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-[64px] grid grid-cols-3 items-center">

          {/* LEFT — hamburger + home */}
          <div className="flex items-center gap-2">
            <button className={`${btn} w-10 h-10 lg:hidden`} onClick={() => setMenuOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/" className={`${btn} w-10 h-10`}>
              <Zap className="w-5 h-5" strokeWidth={1.5} />
            </Link>
            <span className="hidden sm:inline font-bold text-base tracking-tighter uppercase text-white ml-1">CricRank</span>
          </div>

          {/* CENTER — leaderboard */}
          <div className="flex justify-center">
            <Link href="/leaderboard" className={`${btn} flex-col gap-0.5 w-14 h-10 sm:w-auto sm:flex-row sm:gap-2 sm:px-5 sm:h-10`}>
              <Trophy className="w-4 h-4 shrink-0" />
              <span className="text-[7px] sm:text-xs font-black uppercase tracking-widest text-[#a3a3a3]">Ranks</span>
            </Link>
          </div>

          {/* RIGHT — coins + avatar/signin */}
          <div className="flex items-center justify-end gap-2">
            {!loading && user && coins !== null && (
              <Link href="/profile" className={`${btn} flex-col gap-0 w-14 h-10`}>
                <span className="text-[7px] font-black uppercase tracking-widest text-[#fbbf24]/60 leading-none">Coins</span>
                <span className="font-gaming text-sm text-[#fbbf24] leading-none">{coins.toLocaleString()}</span>
              </Link>
            )}

            {!loading && user ? (
              <div className="relative z-[60]">
                <button onClick={() => setUserMenuOpen((v) => !v)} className={`${btn} w-10 h-10`}>
                  {user.user_metadata?.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={user.user_metadata.avatar_url}
                      alt={user.user_metadata?.full_name ?? "User"}
                      width={28} height={28}
                      referrerPolicy="no-referrer"
                      className="rounded-full shrink-0"
                    />
                  ) : (
                    <span className="text-sm font-bold">
                      {user.user_metadata?.full_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "U"}
                    </span>
                  )}
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-[190]" onClick={() => setUserMenuOpen(false)} />
                    <div className="fixed right-0 w-44 bg-[#0a0a0a] border border-[#262626] shadow-2xl z-[200]" style={{ top: '64px' }}>
                      <Link href="/profile" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#a3a3a3] hover:text-white hover:bg-[#1a1a1a] transition-colors">
                        <Zap className="w-3.5 h-3.5 shrink-0" />My Profile
                      </Link>
                      <div className="border-t border-[#1a1a1a]" />
                      <button onClick={() => { setUserMenuOpen(false); signOut(); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#a3a3a3] hover:text-[#ef4444] hover:bg-[#1a1a1a] transition-colors">
                        <LogOut className="w-3.5 h-3.5 shrink-0" />Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : !loading && !user ? (
              <button onClick={signInWithGoogle} className={`${btn} gap-2 h-10 px-3 text-xs font-bold uppercase tracking-widest`}>
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-[100] flex lg:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" 
            onClick={() => setMenuOpen(false)} 
          />
          
          {/* Drawer */}
          <div className="relative w-[280px] h-full bg-[#000000] border-r border-[#262626] flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="h-[64px] flex items-center justify-between px-6 border-b border-[#262626] bg-[#050505]">
              <span className="font-gaming text-xl tracking-widest uppercase text-white mt-1">Menu</span>
              <button 
                onClick={() => setMenuOpen(false)} 
                className="w-8 h-8 flex items-center justify-center bg-[#111] hover:bg-[#1a1a1a] border border-[#262626] text-[#a3a3a3] hover:text-white transition-colors rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <nav className="flex flex-col py-6 px-4 gap-3 flex-1 overflow-y-auto">
              {/* Profile Card Summary if logged in */}
              {!loading && user && (
                <div className="flex items-center gap-3 p-4 mb-2 border border-[#262626] bg-[#0a0a0a] rounded-sm">
                  {user.user_metadata?.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={user.user_metadata.avatar_url} alt="Profile" className="w-10 h-10 object-cover rounded-full grayscale border border-[#333]" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#1f1f1f] flex items-center justify-center text-lg font-bold text-white border border-[#333]">
                      {user.user_metadata?.full_name?.[0]?.toUpperCase() ?? "U"}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-white truncate">{user.user_metadata?.full_name ?? "Player"}</span>
                    <span className="text-[10px] text-[#525252] tracking-widest uppercase font-black">Logged In</span>
                  </div>
                </div>
              )}

              <Link href="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-4 px-4 py-4 border border-[#262626] bg-[#050505] text-[#a3a3a3] hover:bg-[#111111] hover:text-white transition-all group rounded-sm">
                <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="font-gaming tracking-widest text-sm mt-0.5">Home</span>
              </Link>
              
              <Link href="/leaderboard" onClick={() => setMenuOpen(false)} className="flex items-center gap-4 px-4 py-4 border border-[#262626] bg-[#050505] text-[#a3a3a3] hover:bg-[#111111] hover:text-white transition-all group rounded-sm">
                <Trophy className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="font-gaming tracking-widest text-sm mt-0.5">Leaderboard</span>
              </Link>
              
              {user && (
                <Link href="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-4 px-4 py-4 border border-[#262626] bg-[#050505] text-[#a3a3a3] hover:bg-[#111111] hover:text-white transition-all group rounded-sm">
                  <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="font-gaming tracking-widest text-sm mt-0.5">My Profile</span>
                </Link>
              )}
              
              {/* Bottom Actions */}
              <div className="mt-auto flex flex-col pt-4">
                {!loading && !user ? (
                  <button onClick={() => { setMenuOpen(false); signInWithGoogle(); }} className="flex justify-center items-center gap-3 px-4 py-4 border border-[#262626] bg-white text-black hover:bg-[#e6e6e6] transition-all rounded-sm">
                    <LogIn className="w-4 h-4" />
                    <span className="font-gaming tracking-widest text-xs mt-0.5">Sign In / Register</span>
                  </button>
                ) : !loading && user ? (
                  <button onClick={() => { setMenuOpen(false); signOut(); }} className="flex justify-center flex-row-reverse items-center gap-3 px-4 py-4 border border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444] hover:text-white transition-all rounded-sm">
                    <span className="font-gaming tracking-widest text-xs mt-0.5">Sign Out</span>
                    <LogOut className="w-4 h-4" />
                  </button>
                ) : null}
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
