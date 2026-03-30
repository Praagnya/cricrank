"use client";

export const dynamic = "force-dynamic";

import { useUser } from "@/hooks/useUser";
import Header from "@/components/Header";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import ProfileView from "@/components/ProfileView";

export default function PersonalProfilePage() {
  const { user, loading: authLoading } = useUser();

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
      <Header />
      <ProfileView userId={user.id} isEditable={true} />
    </div>
  );
}
