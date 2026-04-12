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

const MS_PER_DAY = 86400000;

/** Calendar-day difference (Asia/Kolkata) between an instant and "now". */
function diffCalendarDaysIstFromNow(targetMs: number): number {
  const targetKey = new Date(targetMs).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const nowKey = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [ty, tm, td] = targetKey.split("-").map(Number);
  const [ny, nm, nd] = nowKey.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(ny, nm - 1, nd)) / MS_PER_DAY);
}

export function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const diffDays = diffCalendarDaysIstFromNow(date.getTime());

  const timeStr = date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  if (diffDays === 0) return `Today · ${timeStr}`;
  if (diffDays === 1) return `Tomorrow · ${timeStr}`;
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

/** localStorage key: last IST date we POST-synced coins for this user */
export function coinSyncStorageKey(googleUserId: string): string {
  return `cricrank_coin_sync_ist_${googleUserId}`;
}

/** YYYY-MM-DD in Asia/Kolkata — for daily coin sync / client-side day checks. */
export function istCalendarDateKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Compact IST date for lists (e.g. recent results). */
export function formatShortDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** CricAPI sometimes leaves pre-match schedule text in result_summary after the match is completed. */
export function prematchScheduleStatusLine(summary: string | null | undefined): boolean {
  const s = (summary ?? "").trim().toLowerCase();
  if (!s) return false;
  if (s.includes("match starts") || s.includes("match yet to begin") || s.includes("yet to begin")) return true;
  if (s.includes("starts at") && /\b(gmt|utc|ist|local time)\b/i.test(s)) return true;
  return false;
}

/** One line to show under recent completed fixtures (never a stale "Match starts at…" blurb). */
export function recentResultSummaryLine(m: {
  status: string;
  result_summary: string | null;
  winner: string | null;
}): string | null {
  const raw = m.result_summary?.trim() || null;
  if (m.status !== "completed") return raw;
  if (raw && !prematchScheduleStatusLine(raw)) return raw;
  if (m.winner) return `${m.winner} won`;
  return raw;
}

export type PredictionState = "open" | "post_toss" | "locked";

type TeamMeta = {
  fullName: string;
  shortCode: string;
  hex: string;
  textColor: string;
  colorClass: string;
};

const TEAM_METADATA: Record<string, TeamMeta> = {
  "Mumbai Indians": { fullName: "Mumbai Indians", shortCode: "MI", hex: "#004BA0", textColor: "#ffffff", colorClass: "bg-blue-700" },
  "Chennai Super Kings": { fullName: "Chennai Super Kings", shortCode: "CSK", hex: "#F9CD05", textColor: "#1a1200", colorClass: "bg-yellow-400" },
  "Royal Challengers Bengaluru": { fullName: "Royal Challengers Bengaluru", shortCode: "RCB", hex: "#C8102E", textColor: "#ffffff", colorClass: "bg-red-600" },
  "Kolkata Knight Riders": { fullName: "Kolkata Knight Riders", shortCode: "KKR", hex: "#3A225D", textColor: "#ffffff", colorClass: "bg-purple-800" },
  "Sunrisers Hyderabad": { fullName: "Sunrisers Hyderabad", shortCode: "SRH", hex: "#F26522", textColor: "#ffffff", colorClass: "bg-orange-500" },
  "Rajasthan Royals": { fullName: "Rajasthan Royals", shortCode: "RR", hex: "#EA1A8E", textColor: "#ffffff", colorClass: "bg-pink-600" },
  "Gujarat Titans": { fullName: "Gujarat Titans", shortCode: "GT", hex: "#1C2C5B", textColor: "#ffffff", colorClass: "bg-sky-800" },
  "Punjab Kings": { fullName: "Punjab Kings", shortCode: "PBKS", hex: "#D71920", textColor: "#ffffff", colorClass: "bg-red-600" },
  "Lucknow Super Giants": { fullName: "Lucknow Super Giants", shortCode: "LSG", hex: "#00B4D8", textColor: "#ffffff", colorClass: "bg-cyan-500" },
  "Delhi Capitals": { fullName: "Delhi Capitals", shortCode: "DC", hex: "#0078BC", textColor: "#ffffff", colorClass: "bg-blue-500" },
};

const LEGACY_TEAM_NAMES: Record<string, string> = {
  MUM: "Mumbai Indians",
  MI: "Mumbai Indians",
  CHE: "Chennai Super Kings",
  CSK: "Chennai Super Kings",
  BLR: "Royal Challengers Bengaluru",
  RCB: "Royal Challengers Bengaluru",
  KOL: "Kolkata Knight Riders",
  KKR: "Kolkata Knight Riders",
  HYD: "Sunrisers Hyderabad",
  SRH: "Sunrisers Hyderabad",
  RAJ: "Rajasthan Royals",
  RR: "Rajasthan Royals",
  GUJ: "Gujarat Titans",
  GT: "Gujarat Titans",
  PUN: "Punjab Kings",
  PBKS: "Punjab Kings",
  LKN: "Lucknow Super Giants",
  LSG: "Lucknow Super Giants",
  DEL: "Delhi Capitals",
  DC: "Delhi Capitals",
  RCBW: "Royal Challengers Bengaluru",
};

function canonicalizeTeam(team: string): string {
  const raw = team.trim();
  return LEGACY_TEAM_NAMES[raw.toUpperCase()] ?? raw;
}

function getTeamMeta(team: string): TeamMeta | undefined {
  return TEAM_METADATA[canonicalizeTeam(team)];
}

export function getPredictionState(tossTime: string, matchStatus?: string, startTime?: string): PredictionState {
  if (matchStatus === "completed" || matchStatus === "live") return "locked";
  if (startTime && new Date() >= new Date(startTime)) return "locked";
  const pastToss = new Date() >= new Date(tossTime);
  return pastToss ? "post_toss" : "open";
}

export function isPredictionLocked(tossTime: string): boolean {
  return new Date() >= new Date(tossTime);
}

export function teamHex(team: string): string {
  return getTeamMeta(team)?.hex ?? "#6366f1";
}

export function teamTextColor(team: string): string {
  return getTeamMeta(team)?.textColor ?? "#ffffff";
}

export function teamColor(team: string): string {
  return getTeamMeta(team)?.colorClass ?? "bg-gray-600";
}

export function teamFullName(team: string): string {
  return getTeamMeta(team)?.fullName ?? canonicalizeTeam(team);
}

export function teamShortCode(team: string): string {
  return getTeamMeta(team)?.shortCode ?? canonicalizeTeam(team).slice(0, 4).toUpperCase();
}

export function streakTierColor(tier: string): string {
  const c: Record<string, string> = {
    "God Mode":  "text-yellow-300",
    "Immortal":  "text-purple-400",
    "Five-fer":  "text-orange-400",
    "Hat-trick": "text-blue-400",
    "In Form":   "text-green-400",
    "Debutant":  "text-[var(--text-muted)]",
  };
  return c[tier] ?? "text-[var(--text-muted)]";
}
