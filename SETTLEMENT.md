# Settlement Flows

How toss, match result, challenges, and first innings score are detected and settled.

---

## 1. Toss Settlement

### What it is
User picks which team wins the toss before `toss_time` (= `start_time − 30 min`).
Entry cost: **100 coins** (deducted on submit).
Payout on win: **200 coins** returned (100 stake back + 100 reward = net +100).
Loss: stake gone (net −100).

### How the winner is detected

CricAPI is checked in order, first field found wins:

| Priority | Source | Field checked |
|---|---|---|
| 1 | `currentMatches` | `tossWinner` / `toss_winner_team` |
| 2 | `match_bbb` | `tossWinner` / `toss_winner_team` |
| 3 | `match_info` | `tossWinner` (most reliable for completed matches) |
| 4 | `match_scorecard` | `tossWinner` |
| 5 | any payload | `status` string contains "won the toss" |

Raw team name → `canonicalize_team()` → matched against `match.team1` / `match.team2`.

### When it fires (background poller)

Scheduled by `_schedule_toss_jobs()` in `poller.py`:

```
toss_time + 5 min   → job_check_toss(match_id)
toss_time + 10 min  → job_check_toss(match_id)
```

If the toss window has already passed when the server starts, a **catchup job** fires 5 seconds after startup.

### Settlement function

`_settle_all_toss_plays_for_match(db, match)` in `routes/matches.py`:
- Iterates all `TossPlay` rows for the match where `winning_team IS NULL`
- Sets `winning_team = match.toss_winner`
- Win → `apply_credit(user, 200, "toss_match")`
- Loss → `coins_won = -100` (no coin movement, stake already deducted)
- Idempotent: skips rows already settled

### Manual override

```
POST /matches/{match_id}/settle-toss?winner=Mumbai+Indians
```

---

## 2. Match Result Settlement

### What it is
User picks the match winner (free, no stake).
Points awarded on correct prediction via `calculate_points(streak)`.
Post-toss predictions (submitted after `toss_time`) receive a multiplier: **0.5×** points.

### How the winner is detected

Poller's `job_check_result()` in `poller.py`:

| Step | Source | Field |
|---|---|---|
| 1 | `currentMatches` | `matchStarted`, `matchEnded`, `matchWinner` |
| 2 | `match_bbb` | same (if not in currentMatches) |
| 3 | `match_info` | fills in `matchWinner` / `matchEnded` if still missing |

`matchWinner` raw string → `canonicalize_winner()` → stored as `match.winner`.

> **Important:** `currentMatches` drops completed matches. `match_bbb` sometimes returns `matchEnded: true` but leaves `matchWinner` empty. `match_info` is the authoritative fallback for winner.

### When it fires (background poller)

Scheduled by `_schedule_result_jobs()`:

```
start_time + 3 h    → job_check_result(match_id)
start_time + 3.5 h  → job_check_result(match_id)
start_time + 4 h    → job_check_result(match_id)
```

If all three windows have passed when the server starts, a **catchup job** fires 10 seconds after startup.

### Settlement function

`_settle_match_internal(db, match)` in `routes/predictions.py`:

Called automatically by `job_check_result` once `match.status == completed` and `match.winner` is set.

**Predictions:**
- Iterates `Prediction` rows where `is_correct IS NULL`
- Correct pick → `is_correct = 1`, awards points, updates streak, `correct_predictions++`
- Wrong pick → `is_correct = 0`, resets streak to 0
- Updates `user.settled_predictions`, `user.points`, `user.current_streak`, `user.longest_streak`

**Challenges (accepted):**
- Finds `Challenge` rows with `status = "accepted"` for this match
- `challenger_team == winner` → challenger wins the pot
- Otherwise → acceptor wins
- `apply_credit(winner, challenger_wants, "challenge_win")`
- Sets `status = "settled"`, `settled_at = now`

**Challenges (open / counter_offered):**
- Finds rows with `status IN ("open", "counter_offered")`
- Match has ended, these can never be accepted
- `apply_credit(challenger, challenger_stake, "challenge_refund")` — stake returned
- Sets `status = "expired"`

Idempotent: predictions with `is_correct IS NOT NULL` are skipped; challenges already in a terminal status are untouched.

### Manual trigger

```
POST /predictions/settle/{match_id}?winner=Sunrisers+Hyderabad
```

This sets `match.winner`, `match.status = completed`, then calls `_settle_match_internal`. Safe to call even if the match is already marked completed (idempotent).

---

## 3. First Innings Score Settlement

### What it is
User predicts the first innings total (50–350 runs). Entry cost: **100 coins**. Max 1 pick per match, locked at `start_time`.

### Reward formula

```
diff = abs(predicted - actual)

if diff >= 20:   reward = 0          (outside window, stake lost)
else:            reward = 5000 - (5000 / 20) * diff
                 rounded to nearest 100
```

| Accuracy | Reward (net) |
|---|---|
| Exact | +5000 |
| ±5 runs | +3700 |
| ±10 runs | +2500 |
| ±15 runs | +1200 |
| ±20+ runs | −100 (stake lost) |

### When it fires

Settled on-demand when `GET /{match_id}/first-innings-status` or `POST /{match_id}/first-innings-pick` is called with unsettled rows — checks `score` array in `match_bbb` / `currentMatches` for a completed first inning (2 innings present, or 10 wickets, or 20 overs bowled).

There is no background poller job for first innings — settlement happens the next time a user checks their status for that match.

---

## 4. Bootstrap Recovery (on every server start)

`bootstrap_scheduler(db)` in `poller.py` runs at startup and daily at midnight UTC:

1. **Schedules jobs** for all upcoming/live matches within 7 days.

2. **Recovers missing winners:** For completed matches in the last 7 days where `winner IS NULL`, calls `fetch_match_info()` to try to recover the winner and commits it.

3. **Re-settles stuck predictions:** For completed matches in the last 7 days where `winner IS NOT NULL` but some `Prediction.is_correct IS NULL`, calls `_settle_match_internal()` to finish settlement.

This makes the system self-healing — a server restart after a failed settlement automatically fixes the state.

---

## 5. Known CricAPI Quirks

| Quirk | Impact | Fix |
|---|---|---|
| `currentMatches` drops completed matches | Poller can't find ended match in live feed | Falls back to `match_bbb` → `match_info` |
| `match_bbb` has `matchEnded: true` but `matchWinner: ""` | Winner never set, settlement skipped | Poller now also checks `match_info` when `matchWinner` is empty |
| `tossWinner` absent from `currentMatches` and `match_bbb` for completed matches | Toss never settles | `_merge_toss_sources` falls back to `match_info` then `match_scorecard` |
| CricAPI rate-limited for 15 min after rapid direct calls | All API calls fail | In-memory TTL cache absorbs repeated requests; stale cache returned on error |
