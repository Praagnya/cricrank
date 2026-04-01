# Scorecard Feature Plan

## What gets built

1. **Updated types** — `src/types/index.ts`
2. **Scorecard component** — `src/components/Scorecard.tsx`
3. **Match detail page** — `src/app/match/[id]/page.tsx`
4. **Link from MatchCarousel** — completed matches get a "Scorecard" button

---

## 1. Type changes (`types/index.ts`)

Replace the loose `Record<string, unknown>[]` with proper types:

```ts
export interface ScorecardBatsman {
  batsman: { id: string; name: string };
  "dismissal-text": string;      // "c Hardik Pandya b Shardul Thakur" | "not out"
  dismissal?: string;            // "catch" | "runout" | undefined
  bowler?: { id: string; name: string };
  catcher?: { id: string; name: string };
  r: number;
  b: number;
  "4s": number;
  "6s": number;
  sr: number;
}

export interface ScorecardBowler {
  bowler: { id: string; name: string };
  o: number;   // overs
  m: number;   // maidens
  r: number;   // runs conceded
  w: number;   // wickets
  nb: number;  // no-balls
  wd: number;  // wides
  eco: number; // economy
}

export interface ScorecardInnings {
  inning: string;               // "Kolkata Knight Riders Inning 1"
  batting: ScorecardBatsman[];
  bowling: ScorecardBowler[];
  extras: Record<string, number>; // currently empty from API
  totals: Record<string, number>; // currently empty from API
}

export interface ScoreEntry {
  r: number;
  w: number;
  o: number;
  inning: string;
}

export interface MatchScorecard {
  match_id: string;
  cricapi_id: string;
  score: ScoreEntry[];
  scorecard: ScorecardInnings[];
}
```

---

## 2. Scorecard component (`src/components/Scorecard.tsx`)

Client component (`"use client"`) with tab state for innings switching.

### UI layout

```
┌─────────────────────────────────────────────────────────┐
│  [ KKR Inning 1 ]   [ MI Inning 2 ]                     │  ← tab row
├─────────────────────────────────────────────────────────┤
│  BATTING                                                 │
│  ┌──────────────────┬────────┬───┬───┬───┬───┬────────┐ │
│  │ Batsman          │ How    │ R │ B │4s │6s │   SR   │ │
│  ├──────────────────┼────────┼───┼───┼───┼───┼────────┤ │
│  │ Ajinkya Rahane   │ c HP.. │67 │40 │ 3 │ 5 │ 167.5  │ │
│  │ Finn Allen       │ c TV.. │37 │17 │ 6 │ 2 │ 217.6  │ │
│  │ Rinku Singh      │not out │33 │21 │ 4 │ 0 │ 157.1  │ │
│  └──────────────────┴────────┴───┴───┴───┴───┴────────┘ │
│                                                          │
│  BOWLING                                                 │
│  ┌──────────────────┬───┬───┬───┬───┬───┬──────────┐    │
│  │ Bowler           │ O │ M │ R │ W │Wd │   Eco    │    │
│  ├──────────────────┼───┼───┼───┼───┼───┼──────────┤    │
│  │ Jasprit Bumrah   │ 4 │ 0 │35 │ 0 │ 1 │    8.8   │    │
│  │ Shardul Thakur   │ 4 │ 0 │39 │ 3 │ 0 │    9.8   │    │
│  └──────────────────┴───┴───┴───┴───┴───┴──────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Visual rules
- Black bg `#000000`, borders `#262626`
- Column headers: `text-[10px] font-black tracking-[0.2em] uppercase text-[#737373]`
- Batsman/bowler names: `text-sm font-bold text-white`
- Numbers: `font-gaming text-sm text-white tabular-nums`
- Dismissal text: `text-xs text-[#525252]` (truncated on mobile)
- "not out" dismissal: `text-[#10b981]` (green)
- Active innings tab: white bg, black text
- Inactive tab: `#111111` bg, `#737373` text

---

## 3. Match detail page (`src/app/match/[id]/page.tsx`)

Server component. Fetches match + scorecard in parallel.

### URL
```
/match/[id]   →   e.g. /match/abc123-...
```

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Header                                                  │
├─────────────────────────────────────────────────────────┤
│  ← Back                                  IPL 2026       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│      [KKR shield]   220/4 (20)   vs   224/4 (19.1)   [MI shield]  │
│                                                          │
│      Mumbai Indians won by 6 wkts                        │
│      Wankhede Stadium · 29 Mar 2026                      │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  SCORECARD                                               │
│                                                          │
│  <Scorecard component with innings tabs>                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Error states
- If match not found → 404
- If scorecard fetch fails (no `cricapi_id`, or upcoming match) → show match header only with "Scorecard not available"

---

## 4. MatchCarousel link change

For `status === "completed"` matches, add a link inside the hero card:

```tsx
{match.status === "completed" && (
  <Link href={`/match/${match.id}`}
    className="text-[10px] font-black tracking-[0.2em] uppercase px-4 py-2
               border border-[#262626] text-[#a3a3a3] hover:border-white
               hover:text-white transition-colors">
    Scorecard
  </Link>
)}
```

Placed in the bottom metadata row next to the countdown/toss area.

---

## Files changed

| File | Change |
|---|---|
| `src/types/index.ts` | Add `ScorecardBatsman`, `ScorecardBowler`, `ScorecardInnings`, `ScoreEntry`, update `MatchScorecard` |
| `src/components/Scorecard.tsx` | New file — innings tabs + batting/bowling tables |
| `src/app/match/[id]/page.tsx` | New file — server page with match header + scorecard |
| `src/components/MatchCarousel.tsx` | Add scorecard link for completed matches |

---

## Known API gaps (handled gracefully)

| Gap | Handling |
|---|---|
| `extras: {}` empty from API | Row hidden if empty |
| `totals: {}` empty from API | Use `score[]` for innings total instead |
| Score missing for some matches (e.g. RCB vs SRH had `score: []`) | Show "—" |
