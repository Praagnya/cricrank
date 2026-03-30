export function formatMatchTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  const dateIST = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const nowIST  = new Date(now.toLocaleString("en-US",  { timeZone: "Asia/Kolkata" }));

  const dateDay = new Date(dateIST.getFullYear(), dateIST.getMonth(), dateIST.getDate());
  const nowDay  = new Date(nowIST.getFullYear(),  nowIST.getMonth(),  nowIST.getDate());
  const diffDays = Math.round((dateDay.getTime() - nowDay.getTime()) / 86400000);

  const timeStr = date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  if (diffDays === 0)  return `Today · ${timeStr}`;
  if (diffDays === 1)  return `Tomorrow · ${timeStr}`;
  if (diffDays === -1) return `Yesterday · ${timeStr}`;

  const dateStr = date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${dateStr} · ${timeStr}`;
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export type PredictionState = "open" | "post_toss" | "locked";

export function getPredictionState(tossTime: string, matchStatus?: string): PredictionState {
  if (matchStatus === "completed" || matchStatus === "live") return "locked";
  const pastToss = new Date() >= new Date(tossTime);
  return pastToss ? "post_toss" : "open";
}

/** @deprecated Use getPredictionState instead */
export function isPredictionLocked(tossTime: string): boolean {
  return new Date() >= new Date(tossTime);
}

export function teamHex(team: string): string {
  const c: Record<string, string> = {
    MUM: "#004BA0",
    CHE: "#F9CD05",
    BLR: "#C8102E",
    KOL: "#3A225D",
    HYD: "#F26522",
    RAJ: "#EA1A8E",
    GUJ: "#1C2C5B",
    PUN: "#D71920",
    LKN: "#00B4D8",
    DEL: "#0078BC",
  };
  return c[team] ?? "#6366f1";
}

export function teamTextColor(team: string): string {
  return team === "CHE" ? "#1a1200" : "#ffffff";
}

// Kept for legacy usage in existing components
export function teamColor(team: string): string {
  const c: Record<string, string> = {
    MUM: "bg-blue-700",   CHE: "bg-yellow-400",
    BLR: "bg-red-600",    KOL: "bg-purple-800",
    HYD: "bg-orange-500", RAJ: "bg-pink-600",
    GUJ: "bg-sky-800",    PUN: "bg-red-600",
    LKN: "bg-cyan-500",   DEL: "bg-blue-500",
  };
  return c[team] ?? "bg-gray-600";
}

export function teamFullName(team: string): string {
  const n: Record<string, string> = {
    MUM: "Mumbai",
    CHE: "Chennai",
    BLR: "Bengaluru",
    KOL: "Kolkata",
    HYD: "Hyderabad",
    RAJ: "Rajasthan",
    GUJ: "Gujarat",
    PUN: "Punjab",
    LKN: "Lucknow",
    DEL: "Delhi",
  };
  return n[team] ?? team;
}

export function streakTierColor(tier: string): string {
  const c: Record<string, string> = {
    "God Mode":     "text-yellow-300",
    "Immortal":     "text-purple-400",
    "Legend":       "text-orange-400",
    "Veteran":      "text-blue-400",
    "Professional": "text-green-400",
    "Rookie":       "text-[var(--text-muted)]",
  };
  return c[tier] ?? "text-[var(--text-muted)]";
}
