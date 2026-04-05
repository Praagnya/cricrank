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

> **`currentMatches` is not called.** Fixtures and `cricapi_id` come from our DB (`series_info` import / admin). Live state uses **`match_info`** (and **`match_scorecard`** where noted).

### 1. Match info (single source for live snapshot + toss primary)

```
GET /v1/match_info?apikey={key}&id={cricapi_id}
```

Single-match snapshot for one `id` (not ball-by-ball).

**Important fields for UI and settlement:**

| Field | Role |
|--------|------|
| `status` | Human-readable state: result, “Team opt to bowl”, chase equation, etc. |
| `score` | **Line innings** array: `{ "r", "w", "o", "inning" }` per innings when the feed has them |
| `matchStarted` / `matchEnded` | Lifecycle flags |
| `matchWinner` | When finished |
| `tossWinner` / `tossChoice` | Toss outcome when known |
| `teams`, `teamInfo`, `venue`, `date`, `dateTimeGMT` | Metadata |

**Example success payload** (`GET /v1/match_info`) — real shape from a live IPL T20; numbers change as the game progresses. The `apikey` in the envelope is echoed by the provider; never log it in production.

> **Quirk:** `status` can stay on an old line (e.g. toss: “X opt to bowl”) while **`score[]` is already updating** for the batting innings. The UI may show both until the provider refreshes `status`.

```json
{
  "apikey": "<your-key>",
  "data": {
    "id": "e43dd29e-c60e-40c9-a6c4-6c1bd69dd671",
    "name": "Sunrisers Hyderabad vs Lucknow Super Giants, 10th Match, Indian Premier League 2026",
    "matchType": "t20",
    "status": "Lucknow Super Giants opt to bowl",
    "venue": "Rajiv Gandhi International Stadium, Hyderabad",
    "date": "2026-04-05",
    "dateTimeGMT": "2026-04-05T10:00:00",
    "teams": ["Sunrisers Hyderabad", "Lucknow Super Giants"],
    "teamInfo": [
      {
        "name": "Lucknow Super Giants",
        "shortname": "LSG",
        "img": "https://g.cricapi.com/iapi/215-637876059669009476.png?w=48"
      },
      {
        "name": "Sunrisers Hyderabad",
        "shortname": "SRH",
        "img": "https://g.cricapi.com/iapi/279-637852957609490368.png?w=48"
      }
    ],
    "score": [
      {
        "r": 63,
        "w": 4,
        "o": 11.5,
        "inning": "Sunrisers Hyderabad Inning 1"
      }
    ],
    "tossWinner": "lucknow super giants",
    "tossChoice": "bowl",
    "series_id": "87c62aac-bc3c-4738-ab93-19da0690488f",
    "fantasyEnabled": true,
    "bbbEnabled": false,
    "hasSquad": true,
    "matchStarted": true,
    "matchEnded": false
  },
  "status": "success",
  "info": {
    "hitsToday": 966,
    "hitsUsed": 1,
    "hitsLimit": 10000,
    "credits": 0,
    "server": 12,
    "queryTime": 24.57,
    "s": 0,
    "cache": 0
  }
}
```

**Use in this repo:** **`GET /matches/{id}/live`** = **`fetch_match_info`** only (`_cricapi_match_snapshot`). Response **`bbb`** is always **`[]`**. Toss: **`match_info`** first, then **`match_scorecard`** if `tossWinner` still missing (`_merge_toss_sources`). Poller result job uses **`match_info`** only.

**Cache:** `CRICAPI_MATCH_INFO_CACHE_SECONDS` (default `20`).

---

### 2. Ball-by-ball (`match_bbb`) — not used

CricAPI exposes `GET /v1/match_bbb` for per-ball data. **This app does not call it** (one scoring source is enough: `match_info`). The provider often returns failures for smaller fixtures anyway.

---

### 3. Match scorecard

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

### 4. Match squad

```
GET /v1/match_squad?apikey={key}&id={cricapi_id}
```

Playing XI per team when `hasSquad: true` on the fixture.

---

### 5. Series info

```
GET /v1/series_info?apikey={key}&id={series_id}
```

> Heavy — use sparingly (e.g. bulk import at season start).

---

## Live matches: what you actually get

These behaviours were checked by calling the API for real `cricapi_id` values.

1. **Toss / not started yet**  
   `status` often reads like *“Lucknow Super Giants opt to bowl”*. **`score` is usually `[]`** on `match_info` and scorecard until play produces a counted innings. The UI correctly shows narrative only.

2. **Line innings `score[]`**  
   Carried on **`match_info`** and on **`match_scorecard`** (root) when present. Each element is typically `{ "r", "w", "o", "inning" }`.

---

## How `/live` gets its payload

`_cricapi_match_snapshot` in `backend/routes/matches.py` returns **`fetch_match_info(cricapi_id)`** (or `{}` on failure). Pre-start and completed DB-only shortcuts on `/live` are unchanged — see route code.

---

## Polling and quota (rough guide)

| Endpoint | Role in this app | Typical cadence |
|----------|------------------|-----------------|
| `match_info` | **`/live`**, poller result job, first-innings primary | Per `/live` poll; cached ~20s per match |
| `match_scorecard` | `/scorecard` route, toss fallback | On demand |
| `match_squad` | Once per match | On demand |
| `series_info` | Imports | Rare |

Exact TTLs: env vars in `backend/cricapi.py` (`CRICAPI_*_CACHE_SECONDS`).

---

## Match linking

Our `Match.cricapi_id` is the CricAPI **`id`** string. Admin paste or series import fills it.

---

## Auto-settle (high level)

Poller and routes watch **`matchEnded`**, **`matchWinner`**, toss fields from **`match_info`** and sometimes **`match_scorecard`** (see `SETTLEMENT.md`).  
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
