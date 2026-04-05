# CricAPI Integration Reference

API provider: [cricketdata.org](https://cricketdata.org)  
Base URL: `https://api.cricapi.com/v1/`  
Auth: `apikey` query param (GUID) on every request  

Configure the key only in **`backend/.env`** as `CRICAPI_KEY` (never commit real keys).

---

## Response envelope (all endpoints)

```json
{
  "apikey": "...",
  "data": { },
  "status": "success",
  "info": {
    "hitsToday": 45,
    "hitsLimit": 10000,
    "credits": 0,
    "server": 5,
    "offsetRows": 0,
    "totalRows": 29,
    "queryTime": 0.52
  }
}
```

Always check `status === "success"` before reading `data`. On failure, `status` is `"failure"` and a `reason` string explains the error (e.g. BBB not available for that match).  
Monitor `hitsToday` / `hitsLimit` to stay within quota.

---

## Endpoints this project uses

### 1. Current matches

```
GET /v1/currentMatches?apikey={key}&offset=0
```

Paginated list of matches the provider considers “current” (live pipeline, offset in steps of 25).

**Typical fields per row** (shape varies by match):

```json
{
  "id": "e02475c1-...",
  "name": "Mumbai Indians vs KKR, 2nd Match",
  "matchType": "t20",
  "status": "Mumbai Indians won by 6 wkts",
  "venue": "Wankhede Stadium, Mumbai",
  "date": "2026-03-29",
  "dateTimeGMT": "2026-03-29T14:00:00",
  "teams": ["Mumbai Indians", "Kolkata Knight Riders"],
  "teamInfo": [{ "name": "Mumbai Indians", "shortname": "MI", "img": "..." }],
  "score": [
    { "r": 220, "w": 4, "o": 20, "inning": "Mumbai Indians Inning 1" },
    { "r": 224, "w": 4, "o": 19.1, "inning": "KKR Inning 1" }
  ],
  "tossWinner": "Mumbai Indians",
  "tossChoice": "bat",
  "matchWinner": "Mumbai Indians",
  "series_id": "87c62aac-...",
  "matchStarted": true,
  "matchEnded": true,
  "fantasyEnabled": true,
  "bbbEnabled": false,
  "hasSquad": true
}
```

**Use in this repo:** background poller, finding a row by `id` (`cricapi_id`), toss/result discovery. **Do not rely on this list alone for the hero line score** — see *Live matches* below.

**Cache:** `CRICAPI_CURRENT_MATCHES_CACHE_SECONDS` (default `60`) in `backend/cricapi.py`.

---

### 2. Match info (primary for line score + status)

```
GET /v1/match_info?apikey={key}&id={cricapi_id}
```

Single-match snapshot: same broad shape as a `currentMatches` row (not ball-by-ball).

**Important fields for UI and settlement:**

| Field | Role |
|--------|------|
| `status` | Human-readable state: result, “Team opt to bowl”, chase equation, etc. |
| `score` | **Line innings** array: `{ "r", "w", "o", "inning" }` per innings when the feed has them |
| `matchStarted` / `matchEnded` | Lifecycle flags |
| `matchWinner` | When finished |
| `tossWinner` / `tossChoice` | Toss outcome when known |
| `teams`, `teamInfo`, `venue`, `date`, `dateTimeGMT` | Metadata |

**Use in this repo:** **`GET /matches/{id}/live`** uses **`match_info` only** (`_cricapi_match_snapshot`). The JSON field **`bbb`** on that response is always **`[]`** (reserved for a future feed). Toss merging uses `currentMatches` then `match_info` then `match_scorecard` (`backend/routes/matches.py`).

**Cache:** `CRICAPI_MATCH_INFO_CACHE_SECONDS` (default `20`).

---

### 3. Ball-by-ball (`match_bbb`) — not used

CricAPI exposes `GET /v1/match_bbb` for per-ball data. **This app does not call it** (one scoring source is enough: `match_info`). The provider often returns failures for smaller fixtures anyway.

---

### 4. Match scorecard

```
GET /v1/match_scorecard?apikey={key}&id={cricapi_id}
```

Full batting/bowling per innings, plus the same top-level **`score[]`** line innings and toss/winner fields as `match_info` when the provider has a card.

**Per-innings object (simplified):**

```json
{
  "inning": "Mumbai Indians Inning 1",
  "batting": [
    {
      "batsman": { "id": "...", "name": "Rohit Sharma" },
      "dismissal": "c Gill b Varun",
      "r": 56, "b": 32, "4s": 6, "6s": 2, "sr": 175.0
    }
  ],
  "bowling": [
    {
      "bowler": { "id": "...", "name": "Varun Chakravarthy" },
      "o": 4, "m": 0, "r": 28, "w": 2, "wd": 1, "nb": 0, "eco": 7.0
    }
  ],
  "extras": { "b": 0, "lb": 2, "wd": 3, "nb": 0, "total": 5 },
  "totals": { "r": 220, "w": 4, "o": 20 }
}
```

Before a card exists you may get **failure** (e.g. scorecard not found). **`totals`** can be empty in some payloads; **`score[]`** at the root is still the reliable line score when present.

**Use in this repo:** `GET /matches/{id}/scorecard` and toss fallbacks — not used for the minimal match-page score hero (that uses `/live` only).

**Cache:** `CRICAPI_MATCH_SCORECARD_CACHE_SECONDS` (default `20`).

---

### 5. Match squad

```
GET /v1/match_squad?apikey={key}&id={cricapi_id}
```

Playing XI per team when `hasSquad: true` on the fixture.

---

### 6. Series info

```
GET /v1/series_info?apikey={key}&id={series_id}
```

> Heavy — use sparingly (e.g. bulk import at season start).

---

## Live matches: what you actually get

These behaviours were checked by calling the API for real `cricapi_id` values (see `backend/scripts/probe_cricapi_score.py`).

1. **Toss / not started yet**  
   `status` often reads like *“Lucknow Super Giants opt to bowl”*. **`score` is usually `[]`** on `match_info`, `currentMatches`, and scorecard until play produces a counted innings. The UI correctly shows narrative only.

2. **Line innings `score[]`**  
   Carried on **`match_info`** and on **`match_scorecard`** (root) when present. Each element is typically `{ "r", "w", "o", "inning" }`.

3. **`currentMatches` vs `match_info`**  
   For the same `id`, the **list row** can still show **`score: []`** while **`match_info` already returns two innings** (list lag). **`/live`** reads **`match_info` only** for the hero line score.

---

## How `/live` gets its payload

`_cricapi_match_snapshot` in `backend/routes/matches.py` returns **`fetch_match_info(cricapi_id)`** (or `{}` on failure). Pre-start and completed DB-only shortcuts on `/live` are unchanged — see route code.

---

## Polling and quota (rough guide)

| Endpoint | Role in this app | Typical cadence |
|----------|------------------|-----------------|
| `currentMatches` | Poller / discovery | ~5 min (cached ~60s server-side) |
| `match_info` | `/live`, poller when CM thin, first-innings | Per client poll of `/live`; cached ~20s |
| `match_scorecard` | `/scorecard` route, toss fallback | On demand |
| `match_squad` | Once per match | On demand |
| `series_info` | Imports | Rare |

Exact TTLs: env vars in `backend/cricapi.py` (`CRICAPI_*_CACHE_SECONDS`).

---

## Match linking

Our `Match.cricapi_id` is the CricAPI **`id`** string. Admin paste or series import fills it.

---

## Auto-settle (high level)

Poller and routes watch **`matchEnded`**, **`matchWinner`**, toss fields from **`currentMatches`**, **`match_info`**, and sometimes **`match_scorecard`** (see `SETTLEMENT.md`).  
`matchWinner` strings are aligned with DB `team1` / `team2` full names.

---

## Fantasy points (optional)

```
GET /v1/match_points?apikey={key}&id={cricapi_id}&ruleset=0
```

Not wired into core flows. Use only when `fantasyEnabled: true` on the fixture; points stabilise after `matchEnded`.

---

## Team name mapping (IPL 2026)

| Full name (DB + CricAPI) | Short | Hex |
|--------------------------|-------|-----|
| Mumbai Indians | MI | #004BA0 |
| Chennai Super Kings | CSK | #F9CD05 |
| Royal Challengers Bengaluru | RCB | #C8102E |
| Kolkata Knight Riders | KKR | #3A225D |
| Sunrisers Hyderabad | SRH | #F26522 |
| Rajasthan Royals | RR | #EA1A8E |
| Gujarat Titans | GT | #1C2C5B |
| Punjab Kings | PBKS | #D71920 |
| Lucknow Super Giants | LSG | #00B4D8 |
| Delhi Capitals | DC | #0078BC |
