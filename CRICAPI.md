# CricAPI Integration Reference

API provider: [cricketdata.org](https://cricketdata.org)
Base URL: `https://api.cricapi.com/v1/`
Auth: `apikey` query param (GUID format) on every request
Plan: M ($12.99/mo) — 10,000 hits/day

---

## API Key

```
8a4ebd2d-3d6f-488e-a3e0-c898019efb1b
```

Store in backend `.env` as `CRICAPI_KEY`.

---

## Endpoints Used in This Project

### 1. Current Matches
```
GET /v1/currentMatches?apikey={key}&offset=0
```
Returns matches that have a toss winner but no match winner yet (i.e. live or recently finished).

**Key response fields per match:**
```json
{
  "id": "e02475c1-...",               // cricapi_id — store on our Match model
  "name": "Mumbai Indians vs KKR, 2nd Match",
  "matchType": "t20",
  "status": "Mumbai Indians won by 6 wkts",  // human-readable result
  "venue": "Wankhede Stadium, Mumbai",
  "date": "2026-03-29",
  "dateTimeGMT": "2026-03-29T14:00:00",      // UTC
  "teams": ["Mumbai Indians", "Kolkata Knight Riders"],
  "teamInfo": [
    { "name": "Mumbai Indians", "shortname": "MI", "img": "..." }
  ],
  "score": [
    { "r": 220, "w": 4,  "o": 20,   "inning": "Mumbai Indians Inning 1" },
    { "r": 224, "w": 4,  "o": 19.1, "inning": "KKR Inning 1" }
  ],
  "tossWinner": "Mumbai Indians",
  "tossChoice": "bat",
  "matchWinner": "Mumbai Indians",   // null if match not finished
  "series_id": "87c62aac-...",
  "matchStarted": true,
  "matchEnded": true,
  "fantasyEnabled": true,
  "bbbEnabled": false,
  "hasSquad": true
}
```

**Use for:**
- Detecting when a match goes live (`matchStarted: true, matchEnded: false`)
- Auto-settling matches (`matchEnded: true` + `matchWinner`)
- Showing current score per innings (`score[]`)

---

### 2. Ball-by-Ball
```
GET /v1/match_bbb?apikey={key}&id={cricapi_id}
```
Returns cumulative ball-by-ball data for a match. Poll every 30s during live matches.

**Key response fields:**
```json
{
  "id": "ea479cff-...",
  "name": "...",
  "matchWinner": "Team Name",   // null if not finished
  "matchStarted": true,
  "matchEnded": false,
  "score": [
    { "r": 92, "w": 10, "o": 17.4, "inning": "Team A Inning 1" }
  ],
  "bbb": [
    {
      "n": 1,           // sequential ball number
      "inning": 0,      // 0 = 1st innings, 1 = 2nd innings
      "over": 0,        // over number (0-indexed)
      "ball": 1,        // ball within over (1-6)
      "batsman": { "id": "...", "name": "Player Name" },
      "bowler":  { "id": "...", "name": "Player Name" },
      "runs": 4,
      "penalty": null,  // "wide" | "noball" | "bye" | "legbye" | null
      "extras": 0
    }
  ]
}
```

**Use for:**
- Live ball-by-ball commentary feed
- Auto-settle: check `matchEnded` + `matchWinner` on each poll

---

### 3. Match Scorecard
```
GET /v1/match_scorecard?apikey={key}&id={cricapi_id}
```
Full batting/bowling scorecard per innings.

**Key response fields:**
```json
{
  "scorecard": [
    {
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
  ]
}
```

**Use for:** Post-match scorecard display (not needed for live polling).

---

### 4. Match Squad
```
GET /v1/match_squad?apikey={key}&id={cricapi_id}
```
Playing XI for each team. Available when `hasSquad: true`.

**Key response fields:**
```json
[
  {
    "teamName": "Mumbai Indians",
    "players": [
      {
        "id": "...",
        "name": "Rohit Sharma",
        "role": "Batsman",
        "battingStyle": "Right Handed Bat",
        "bowlingStyle": "Right-arm medium",
        "country": "India",
        "playerImg": "https://..."
      }
    ]
  }
]
```

**Use for:** Showing playing 11 before/during match. Cache in DB — fetch once per match.

---

### 5. Series Info
```
GET /v1/series_info?apikey={key}&id={series_id}
```
Full match list for a series (e.g. IPL 2026).

> ⚠️ Marked "Very HEAVY" by CricAPI — max 2-3 calls/day. Use to import fixtures at start of season only.

**Use for:** Bulk importing IPL 2026 fixtures into our DB.

---

## Response Envelope (all endpoints)

```json
{
  "apikey": "...",
  "data": { ... },     // or array
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

Always check `status === "success"` before reading `data`.
Monitor `hitsToday` / `hitsLimit` to stay within quota.

---

## Polling Strategy

| Endpoint | When to poll | Frequency |
|---|---|---|
| `currentMatches` | Always (background) | Every 5 min |
| `match_bbb` | Only during live match | Every 30s |
| `match_squad` | Once per match (on create) | On demand |
| `series_info` | Once per season | Manual trigger |

**Daily hit estimate (double-header day):**
- `currentMatches`: 288 calls (every 5 min × 24h)
- `match_bbb`: ~840 calls (2 matches × 3.5h × 2/min)
- Total: ~1,130 / 10,000 = **11% of quota**

---

## Match Linking

Our `Match` model stores a `cricapi_id` field (the CricAPI match UUID).
This is the join key between our DB and CricAPI.

```
Our DB Match.cricapi_id  ←→  CricAPI match "id" field
```

When creating a match in admin, paste the CricAPI match ID.
Alternatively, use the series import flow to auto-populate.

---

## Auto-Settle Logic

When `match_bbb` or `currentMatches` poll returns `matchEnded: true`:

```python
if data["matchEnded"] and data["matchWinner"]:
    winner = data["matchWinner"]  # e.g. "Mumbai Indians"
    # winner must match match.team1 or match.team2 exactly
    await settle_match(match_id=our_match.id, winner=winner)
```

The `matchWinner` string matches the full team name stored in our `team1`/`team2` fields — this is why we use full team names in our DB.

---

## Fantasy Points API

Useful for calculating per-player fantasy points if we ever add a fantasy layer.

```
GET /v1/match_points?apikey={key}&id={cricapi_id}&ruleset=0
```

**Parameters:**
- `ruleset`: `0` = default ruleset. Custom rulesets created in member area.

**Response:**
```json
{
  "data": {
    "innings": [
      {
        "inning": "Mumbai Indians Inning 1",
        "batting": [{ "name": "Rohit Sharma", "id": "...", "points": 54 }],
        "bowling": [{ "name": "Bumrah", "id": "...", "points": 38 }],
        "catching": [{ "name": "Pollard", "id": "...", "points": 8 }]
      }
    ],
    "totals": [
      { "name": "Rohit Sharma", "id": "...", "points": 54 }
    ]
  }
}
```

> Points fluctuate during live matches. Only stable once `matchEnded: true`.
> Not all matches are available in Fantasy APIs — check `fantasyEnabled: true` on the match before calling.

---

## Scorecard API (Full Batting/Bowling)

```
GET /v1/match_scorecard?apikey={key}&id={cricapi_id}
```

**Response — `scorecard[]` per innings:**
```json
{
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
  "catching": [{ "fielder": "...", "catch": 1, "stumped": 0, "runout": 0 }],
  "extras": { "b": 0, "lb": 2, "wd": 3, "nb": 0, "total": 5 },
  "totals": { "r": 220, "w": 4, "o": 20 },
  "inning": "Mumbai Indians Inning 1"
}
```

Also includes top-level: `tossWinner`, `tossChoice`, `matchWinner`, `teams`, `score[]`.

---

## Team Name Mapping (IPL 2026)

| Full Name (DB + CricAPI) | Short Code | Hex Color |
|---|---|---|
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
