"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useUser } from "@/hooks/useUser";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import ProfileView from "@/components/ProfileView";
import { getApiBaseUrl } from "@/lib/api-base";
import { fetchWithRetry } from "@/lib/fetch-with-retry";

export default function PersonalProfilePage() {
  const { user, loading: authLoading } = useUser();

  // Same upsert as the header (daily bonus, referral, etc.) — do not block the UI on it;
  // ProfileView loads via GET immediately so we avoid “LOADING PROFILE” then “LOADING INTELLIGENCE”.
  useEffect(() => {
    if (!user) return;
    const metadata = user.user_metadata;
    fetchWithRetry(`${getApiBaseUrl()}/users/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        google_id: user.id,
        name: metadata?.full_name ?? user.email?.split("@")[0] ?? "Anonymous",
        email: user.email ?? "unknown@example.com",
        avatar_url: metadata?.avatar_url ?? null,
      }),
      cache: "no-store",
    }).catch(() => {});
  }, [user?.id]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-gaming text-white">
        <div className="animate-pulse tracking-[0.5em] text-[#525252]">LOADING PROFILE</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
        <AlertTriangle className="w-12 h-12 text-[#ef4444] mb-4" />
        <h1 className="font-gaming text-2xl tracking-widest text-center mb-2">ACCESS DENIED</h1>
        <p className="tracking-widest text-[#a3a3a3] text-xs uppercase mb-8">Please sign in to view your profile</p>
        <Link href="/" className="px-8 py-4 bg-white text-black font-gaming font-bold tracking-widest hover:bg-[#c8c8c8] transition-colors">
          RETURN HOME
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      <ProfileView userId={user.id} isEditable={true} />
    </div>
  );
}
