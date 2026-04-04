from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from coin_ledger import apply_credit, apply_debit
from cricapi import CricAPIError, fetch_current_matches, fetch_match_bbb, fetch_match_info, fetch_match_scorecard, fetch_series_info
from database import get_db
from models import Match, MatchStatus, Prediction, TossPlay, FirstInningsPick, User
from prediction_agent import get_prediction_safe
from schemas import (
    AIPredictionResponse,
    MatchLiveResponse,
    MatchPublic,
    MatchScorecardResponse,
    SeriesSyncRequest,
    SeriesSyncResponse,
    TossPickRequest,
    TossPickResponse,
    TossStatusResponse,
    FirstInningsPickRequest,
    FirstInningsPickResponse,
    FirstInningsStatusResponse,
)
from team_metadata import canonicalize_team, canonicalize_winner, league_aliases, normalize_team_pair, normalize_text

router = APIRouter()

# Toss prediction — win this many coins when feed reports toss and your pick matches.
TOSS_MIN_COINS = 50


def _merge_toss_sources(match: Match, seed: dict | None = None) -> dict:
    """
    Merge CricAPI payloads until we can resolve toss (or exhaust sources).
    Order minimizes calls: currentMatches + match_info before match_bbb (often empty)
    and match_scorecard (heavier).

    If ``seed`` is set (e.g. from GET /live), it should already include current + match_info;
    only match_bbb and match_scorecard are fetched as extras.
    """
    if not match.cricapi_id:
        return {}

    def _toss_known(m: dict) -> bool:
        return _extract_toss_winner_name(m, match.team1, match.team2) is not None

    merged: dict = dict(seed) if seed else {}

    if _toss_known(merged):
        return merged

    if seed is None:
        cur = _find_current_match_payload(match.cricapi_id) or {}
        merged = {**cur, **merged}
        if _toss_known(merged):
            return merged
        try:
            info = fetch_match_info(match.cricapi_id) or {}
            if isinstance(info, dict):
                # Same relative precedence as before: currentMatches payload wins over match_info
                # on duplicate keys when BBB is empty; BBB overlays next.
                merged = {**info, **merged}
        except CricAPIError:
            pass
        if _toss_known(merged):
            return merged

    bbb: dict = {}
    try:
        bbb = fetch_match_bbb(match.cricapi_id) or {}
    except CricAPIError:
        bbb = {}
    if isinstance(bbb, dict) and bbb:
        merged = {**merged, **bbb}
    if _toss_known(merged):
        return merged

    try:
        sc = fetch_match_scorecard(match.cricapi_id) or {}
        if isinstance(sc, dict) and sc:
            # Same as historical behavior: scorecard fills gaps; existing merged wins on key clash.
            merged = {**sc, **merged}
    except CricAPIError:
        pass
    return merged


def _extract_toss_winner_name(payload: dict, team1: str, team2: str) -> str | None:
    raw = (
        payload.get("toss_winner_team")
        or payload.get("tossWinner")
        or payload.get("tossWinnerTeam")
    )
    if raw and isinstance(raw, str):
        low = raw.strip().lower()
        if "uncontested" in low or low == "no toss":
            raw = None
    if not raw or not isinstance(raw, str):
        status = payload.get("status") or ""
        if isinstance(status, str) and "won the toss" in status.lower():
            t1, t2 = canonicalize_team(team1), canonicalize_team(team2)
            for t in (t1, t2):
                if t and t.lower() in status.lower():
                    return t
        return None
    tw = canonicalize_team(raw.strip())
    if not tw:
        return None
    t1, t2 = canonicalize_team(team1), canonicalize_team(team2)
    if tw == t1:
        return t1
    if tw == t2:
        return t2
    nt = normalize_text(tw)
    for t in (t1, t2):
        if t and normalize_text(t) == nt:
            return t
    return None


def _refresh_match_toss_winner(db: Session, match: Match, payload_hint: dict | None = None) -> None:
    """
    Update toss_winner from CricAPI if not yet set.
    The background poller proactively calls this; this function acts as a fallback
    for cases where the poller hasn't run (e.g. first deploy, server restart).

    ``payload_hint`` avoids duplicate match_info/current fetches when the caller
    already merged them (e.g. GET /live).
    """
    if match.toss_winner:
        return
    if payload_hint:
        tw = _extract_toss_winner_name(payload_hint, match.team1, match.team2)
        if tw:
            match.toss_winner = tw
            return
    merged = _merge_toss_sources(match, seed=payload_hint)
    tw = _extract_toss_winner_name(merged, match.team1, match.team2)
    if tw:
        match.toss_winner = tw


def _settle_toss_row(db: Session, row: TossPlay, match: Match) -> None:
    if row.winning_team is not None:
        return
    if not match.toss_winner:
        return
    row.winning_team = match.toss_winner
    if row.picked_team == match.toss_winner:
        row.coins_won = row.stake          # net gain
        apply_credit(
            db,
            row.user_id,
            row.stake * 2,                 # return stake + reward
            "toss_match",
            idempotency_key=f"toss_match:{row.user_id}:{row.match_id}",
            ref_type="match",
            ref_id=str(row.match_id),
        )
    else:
        row.coins_won = -row.stake         # net loss (stake already deducted)


def _settle_all_toss_plays_for_match(db: Session, match: Match) -> None:
    for row in db.query(TossPlay).filter(TossPlay.match_id == match.id).all():
        if row.winning_team is None:
            _settle_toss_row(db, row, match)


def _toss_pick_response(row: TossPlay, user: User, already_played: bool) -> TossPickResponse:
    settled = row.winning_team is not None
    pending = row.picked_team is not None and not settled
    return TossPickResponse(
        picked_team=row.picked_team,
        stake=row.stake,
        winning_team=row.winning_team,
        coins_won=row.coins_won,
        coins_balance=user.coins,
        already_played=already_played,
        pending=pending,
        settled=settled,
    )


def _parse_gmt_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _match_status_from_payload(payload: dict) -> MatchStatus:
    if payload.get("matchEnded"):
        return MatchStatus.completed
    if payload.get("matchStarted"):
        return MatchStatus.live
    return MatchStatus.upcoming


def _fixture_key(team1: str, team2: str, start_time: datetime) -> tuple[tuple[str, str], str]:
    return (
        normalize_team_pair(team1, team2),
        start_time.astimezone(timezone.utc).replace(second=0, microsecond=0).isoformat(),
    )


def _sync_predictions_for_match(db: Session, match: Match) -> int:
    updated = 0
    predictions = db.query(Prediction).filter(Prediction.match_id == match.id).all()
    for prediction in predictions:
        canonical = canonicalize_team(prediction.selected_team)
        if canonical != prediction.selected_team:
            prediction.selected_team = canonical
            updated += 1
    return updated


def _sync_winner(match: Match) -> int:
    canonical = canonicalize_winner(match.winner)
    if canonical != match.winner:
        match.winner = canonical
        return 1
    return 0


def _apply_fixture_to_match(match: Match, fixture: dict, payload: SeriesSyncRequest, resolved_series_name: str) -> None:
    teams = fixture.get("teams") or []
    if len(teams) != 2:
        raise HTTPException(status_code=400, detail=f"Fixture {fixture.get('id')} does not have exactly two teams")

    start_time = _parse_gmt_datetime(fixture["dateTimeGMT"])
    match.cricapi_id = fixture["id"]
    match.series_id = payload.series_id
    match.series_name = payload.series_name or resolved_series_name
    match.league = payload.league
    match.season = payload.season
    match.team1 = canonicalize_team(teams[0])
    match.team2 = canonicalize_team(teams[1])
    match.venue = fixture.get("venue") or match.venue
    match.start_time = start_time
    match.toss_time = start_time - timedelta(minutes=30)
    match.status = _match_status_from_payload(fixture)
    match.winner = canonicalize_winner(fixture.get("matchWinner") or match.winner)
    match.result_summary = fixture.get("status") or match.result_summary


def _find_current_match_payload(cricapi_id: str) -> dict | None:
    try:
        current_matches = fetch_current_matches()
    except CricAPIError:
        return None

    for match in current_matches:
        if match.get("id") == cricapi_id:
            return match
    return None


def _status_text_fallback(match: Match) -> str | None:
    if match.result_summary:
        return match.result_summary
    if match.status == MatchStatus.completed and match.winner:
        return f"{match.winner} won"
    if match.status == MatchStatus.live:
        return "Match live"
    if match.status == MatchStatus.upcoming:
        return "Match not started"
    return None


@router.get("/", response_model=list[MatchPublic])
def list_matches(
    league: str = Query(None),
    season: str = Query(None),
    status: MatchStatus = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Match)
    if league:
        q = q.filter(Match.league == league)
    if season:
        q = q.filter(Match.season == season)
    if status:
        q = q.filter(Match.status == status)
    return q.order_by(Match.start_time).all()


@router.post("/sync-series", response_model=SeriesSyncResponse)
def sync_series(payload: SeriesSyncRequest, db: Session = Depends(get_db)):
    try:
        series_data = fetch_series_info(payload.series_id)
    except CricAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    info = series_data.get("info") or {}
    match_list = series_data.get("matchList") or []
    resolved_series_name = payload.series_name or info.get("name") or payload.series_id

    existing_matches = (
        db.query(Match)
        .filter(Match.season == payload.season, Match.league.in_(league_aliases(payload.league)))
        .all()
    )
    existing_by_cricapi = {match.cricapi_id: match for match in existing_matches if match.cricapi_id}
    existing_by_key = {
        _fixture_key(match.team1, match.team2, match.start_time): match
        for match in existing_matches
    }

    created = 0
    updated = 0
    matched_existing = 0
    predictions_updated = 0
    winners_updated = 0

    for fixture in match_list:
        teams = fixture.get("teams") or []
        if len(teams) != 2 or not fixture.get("dateTimeGMT"):
            continue

        start_time = _parse_gmt_datetime(fixture["dateTimeGMT"])
        key = _fixture_key(teams[0], teams[1], start_time)
        existing = existing_by_cricapi.get(fixture["id"]) or existing_by_key.get(key)

        if existing:
            matched_existing += int(existing.cricapi_id is None)
            _apply_fixture_to_match(existing, fixture, payload, resolved_series_name)
            predictions_updated += _sync_predictions_for_match(db, existing)
            winners_updated += _sync_winner(existing)
            updated += 1
            existing_by_cricapi[existing.cricapi_id] = existing
            existing_by_key[_fixture_key(existing.team1, existing.team2, existing.start_time)] = existing
            continue

        match = Match(
            cricapi_id=fixture["id"],
            series_id=payload.series_id,
            series_name=resolved_series_name,
            league=payload.league,
            season=payload.season,
            team1=canonicalize_team(teams[0]),
            team2=canonicalize_team(teams[1]),
            venue=fixture.get("venue") or "TBA",
            start_time=start_time,
            toss_time=start_time - timedelta(minutes=30),
            status=_match_status_from_payload(fixture),
            winner=canonicalize_winner(fixture.get("matchWinner")),
        )
        db.add(match)
        created += 1

    db.commit()

    return SeriesSyncResponse(
        series_id=payload.series_id,
        series_name=resolved_series_name,
        created=created,
        updated=updated,
        matched_existing=matched_existing,
        predictions_updated=predictions_updated,
        winners_updated=winners_updated,
        total_matches=len(match_list),
    )


@router.get("/today", response_model=list[MatchPublic])
def today_matches(db: Session = Depends(get_db)):
    # Status updates are handled by the background poller — just serve DB state.
    now = datetime.now(timezone.utc)
    return db.query(Match).filter(func.date(Match.start_time) == func.date(now)).order_by(Match.start_time).all()


@router.get("/upcoming", response_model=list[MatchPublic])
def upcoming_matches(
    limit: int = Query(10, le=20),
    days: int = Query(None, ge=1, le=30),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    q = db.query(Match).filter(Match.start_time >= now, Match.status == MatchStatus.upcoming)
    if days is not None:
        q = q.filter(Match.start_time <= now + timedelta(days=days))
    return q.order_by(Match.start_time).limit(limit).all()


@router.get("/recent-completed", response_model=list[MatchPublic])
def recent_completed_matches(
    limit: int = Query(5, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Most recently finished matches by start time (proxy for recency)."""
    return (
        db.query(Match)
        .filter(Match.status == MatchStatus.completed)
        .order_by(desc(Match.start_time))
        .limit(limit)
        .all()
    )


@router.post("/{match_id}/settle-toss")
def settle_toss(match_id: str, winner: str = Query(None), db: Session = Depends(get_db)):
    """Manually trigger toss settlement. Pass ?winner=TeamName to override CricAPI."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if winner:
        tw = canonicalize_team(winner)
        if tw not in (match.team1, match.team2):
            raise HTTPException(status_code=400, detail=f"winner must be '{match.team1}' or '{match.team2}'")
        match.toss_winner = tw
    else:
        _refresh_match_toss_winner(db, match)
    if not match.toss_winner:
        return {"settled": False, "detail": "Toss winner not yet available from CricAPI"}
    _settle_all_toss_plays_for_match(db, match)
    db.commit()
    return {"settled": True, "toss_winner": match.toss_winner}


@router.get("/{match_id}", response_model=MatchPublic)
def get_match(match_id: str, db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return match


@router.get("/{match_id}/prediction", response_model=AIPredictionResponse)
def get_ai_prediction(match_id: str, db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return get_prediction_safe(
        team1=match.team1,
        team2=match.team2,
        venue=match.venue,
        league=match.league,
        season=match.season,
    )


@router.get("/{match_id}/crowd", response_model=dict)
def get_crowd_prediction(match_id: str, db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    total = db.query(Prediction).filter(Prediction.match_id == match_id).count()
    if total == 0:
        return {match.team1: 50.0, match.team2: 50.0, "total_votes": 0}

    team1_votes = db.query(Prediction).filter(
        Prediction.match_id == match_id,
        Prediction.selected_team == match.team1,
    ).count()

    team1_pct = round((team1_votes / total) * 100, 1)
    return {
        match.team1: team1_pct,
        match.team2: round(100 - team1_pct, 1),
        "total_votes": total,
    }


@router.get("/{match_id}/toss-status", response_model=TossStatusResponse)
def get_toss_status(match_id: str, google_id: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    _refresh_match_toss_winner(db, match)
    _settle_all_toss_plays_for_match(db, match)
    db.commit()

    row = (
        db.query(TossPlay)
        .filter(TossPlay.user_id == user.id, TossPlay.match_id == match.id)
        .first()
    )
    if not row:
        return TossStatusResponse(played=False, pending=False, settled=False)
    settled = row.winning_team is not None
    return TossStatusResponse(
        played=True,
        picked_team=row.picked_team,
        stake=row.stake,
        winning_team=row.winning_team,
        coins_won=row.coins_won,
        pending=not settled,
        settled=settled,
    )


@router.post("/{match_id}/toss-pick", response_model=TossPickResponse)
def play_toss(
    match_id: str,
    body: TossPickRequest,
    google_id: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    picked = canonicalize_team(body.picked_team)
    if picked not in (match.team1, match.team2):
        raise HTTPException(status_code=400, detail="picked_team must be one of the two sides in this match")

    existing = (
        db.query(TossPlay)
        .filter(TossPlay.user_id == user.id, TossPlay.match_id == match.id)
        .first()
    )
    if existing:
        _refresh_match_toss_winner(db, match)
        _settle_toss_row(db, existing, match)
        db.commit()
        db.refresh(user)
        db.refresh(existing)
        return _toss_pick_response(existing, user, True)

    now = datetime.now(timezone.utc)
    lock_time = match.toss_time if match.toss_time.tzinfo else match.toss_time.replace(tzinfo=timezone.utc)
    if now >= lock_time:
        raise HTTPException(
            status_code=400,
            detail="Toss prediction is locked for this match.",
        )

    _refresh_match_toss_winner(db, match)
    db.flush()
    if match.toss_winner:
        raise HTTPException(
            status_code=400,
            detail="Toss outcome is already known. You cannot submit a new prediction.",
        )

    stake = body.stake
    if stake < TOSS_MIN_COINS:
        raise HTTPException(status_code=400, detail=f"minimum stake is {TOSS_MIN_COINS} coins")
    if user.coins < stake:
        raise HTTPException(status_code=400, detail="insufficient_coins")

    row = TossPlay(
        user_id=user.id,
        match_id=match.id,
        picked_team=picked,
        stake=stake,
        winning_team=None,
        coins_won=0,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        existing = (
            db.query(TossPlay)
            .filter(TossPlay.user_id == user.id, TossPlay.match_id == match.id)
            .first()
        )
        if not existing:
            raise HTTPException(status_code=409, detail="Could not record toss") from None
        user = db.query(User).filter(User.google_id == google_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")
        _refresh_match_toss_winner(db, match)
        _settle_toss_row(db, existing, match)
        db.commit()
        db.refresh(user)
        db.refresh(existing)
        return _toss_pick_response(existing, user, True)

    # Deduct stake now that the row is confirmed
    try:
        apply_debit(
            db,
            user.id,
            stake,
            "toss_stake",
            idempotency_key=f"toss_stake:{user.id}:{match.id}",
            ref_type="match",
            ref_id=str(match.id),
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="insufficient_coins")

    _refresh_match_toss_winner(db, match)
    _settle_toss_row(db, row, match)
    db.commit()
    db.refresh(user)
    db.refresh(row)
    return _toss_pick_response(row, user, False)


@router.get("/{match_id}/live", response_model=MatchLiveResponse)
def get_live_match(match_id: str, db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if not match.cricapi_id:
        raise HTTPException(status_code=400, detail="Match is not linked to CricAPI")

    # Live score: match_info + currentMatches (2 cache keys). merge order is {**cur, **info}
    # so info wins on duplicate keys — but CricAPI often returns score: [] on match_info while
    # currentMatches has real rows; empty list would wipe the score, so coalesce explicitly.
    info: dict = {}
    try:
        info = fetch_match_info(match.cricapi_id) or {}
    except CricAPIError:
        pass
    current_payload = _find_current_match_payload(match.cricapi_id)
    cur = current_payload or {}
    source = {**cur, **info}

    def _nonempty_score_rows(raw) -> list:
        if not isinstance(raw, list):
            return []
        return [x for x in raw if x]

    inf_rows = _nonempty_score_rows(info.get("score"))
    cur_rows = _nonempty_score_rows(cur.get("score"))
    if inf_rows:
        source["score"] = inf_rows
    elif cur_rows:
        source["score"] = cur_rows
    else:
        source["score"] = []

    # Last resort for line score only when both feeds lack innings (cached; skips if BBB empty/errors).
    if not source["score"]:
        try:
            bbb = fetch_match_bbb(match.cricapi_id) or {}
            if isinstance(bbb, dict):
                bbb_rows = _nonempty_score_rows(bbb.get("score"))
                if bbb_rows:
                    source = {**source, **bbb}
                    source["score"] = bbb_rows
        except CricAPIError:
            pass

    status = (
        _match_status_from_payload(source)
        if source
        else (MatchStatus.live if match.status == MatchStatus.live else match.status)
    )
    match_started = bool(source.get("matchStarted")) if source else match.status in (MatchStatus.live, MatchStatus.completed)
    match_ended = bool(source.get("matchEnded")) if source else match.status == MatchStatus.completed
    status_text = source.get("status") or _status_text_fallback(match)
    match_winner = (
        canonicalize_winner(source.get("matchWinner"))
        or canonicalize_winner(match.winner)
    )
    result_summary = source.get("status") or match.result_summary or status_text

    _refresh_match_toss_winner(db, match, payload_hint=source)
    _settle_all_toss_plays_for_match(db, match)
    try:
        db.commit()
    except Exception:
        db.rollback()

    return MatchLiveResponse(
        match_id=match.id,
        cricapi_id=match.cricapi_id,
        status=status,
        match_started=match_started,
        match_ended=match_ended,
        status_text=status_text,
        match_winner=match_winner,
        result_summary=result_summary,
        score=source.get("score") or [],
        bbb=[],
    )


@router.get("/{match_id}/scorecard", response_model=MatchScorecardResponse)
def get_match_scorecard(match_id: str, db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if not match.cricapi_id:
        raise HTTPException(status_code=400, detail="Match is not linked to CricAPI")

    payload: dict = {}
    try:
        payload = fetch_match_scorecard(match.cricapi_id) or {}
    except CricAPIError:
        pass

    # Fast path: batting tables or line scores already present (1 CricAPI call).
    if payload.get("scorecard") or (payload.get("score") or []):
        return MatchScorecardResponse(
            match_id=match.id,
            cricapi_id=match.cricapi_id,
            score=payload.get("score") or [],
            scorecard=payload.get("scorecard") or [],
        )

    # Prefer match_info before match_bbb — line scores are cheaper and BBB often fails.
    if match.status in (MatchStatus.live, MatchStatus.completed):
        try:
            inf = fetch_match_info(match.cricapi_id) or {}
            if isinstance(inf, dict) and inf:
                payload = {**payload, **inf}
        except CricAPIError:
            pass

    if not (payload.get("score") or []) and not (payload.get("scorecard") or []):
        try:
            bbb = fetch_match_bbb(match.cricapi_id) or {}
            if isinstance(bbb, dict) and bbb:
                payload = {**payload, **bbb}
        except CricAPIError:
            pass

    if not (payload.get("score") or []) and not (payload.get("scorecard") or []):
        raise HTTPException(status_code=502, detail="Scorecard not available")

    return MatchScorecardResponse(
        match_id=match.id,
        cricapi_id=match.cricapi_id,
        score=payload.get("score") or [],
        scorecard=payload.get("scorecard") or [],
    )


# ── First Innings Score ────────────────────────────────────────────────────────

ENTRY_COINS          = 100   # flat entry cost
MAX_REWARD           = 5_000 # max net gain (exact match)
REWARD_WINDOW        = 20    # runs within which a reward is paid
MAX_FIRST_INNINGS_PICKS = 1


def calculate_first_innings_reward(predicted_score: int, actual_score: int) -> int:
    """
    Sliding-scale reward for a first innings score prediction.

    - Within REWARD_WINDOW runs: reward = MAX_REWARD - (MAX_REWARD / REWARD_WINDOW) * diff
    - Outside window: reward = 0
    - Result is rounded to nearest 100 and clamped to >= 0.
    """
    if predicted_score < 0 or actual_score < 0:
        return 0
    diff = abs(predicted_score - actual_score)
    if diff >= REWARD_WINDOW:
        return 0
    raw = MAX_REWARD - (MAX_REWARD / REWARD_WINDOW) * diff
    return max(0, round(raw / 100) * 100)


def _get_first_innings_result(cricapi_id: str) -> tuple[str | None, int | None]:
    """
    Returns (batting_team, runs) when first innings is complete, else (None, None).
    Tries BBB → currentMatches → scorecard (scorecard works for completed matches).
    """
    def _fetch_scorecard():
        try:
            return fetch_match_scorecard(cricapi_id) or {}
        except CricAPIError:
            return {}

    sources = [
        lambda: fetch_match_bbb(cricapi_id),
        lambda: _find_current_match_payload(cricapi_id) or {},
        _fetch_scorecard,
    ]
    for fetch_fn in sources:
        try:
            data = fetch_fn() or {}
        except CricAPIError:
            continue
        score: list[dict] = data.get("score") or []
        if not score:
            continue
        first = next((s for s in score if "Inning 1" in s.get("inning", "")), None)
        if not first:
            continue
        complete = len(score) >= 2 or first.get("w", 0) >= 10 or float(first.get("o", 0)) >= 20.0
        if complete:
            team = first["inning"].replace(" Inning 1", "").strip()
            return canonicalize_team(team) or team, int(first.get("r", 0))
    return None, None


def _settle_first_innings_picks(db: Session, match: Match) -> None:
    actual_team, actual_score = _get_first_innings_result(match.cricapi_id)
    if actual_score is None:
        return
    rows = (
        db.query(FirstInningsPick)
        .filter(FirstInningsPick.match_id == match.id, FirstInningsPick.actual_score == None)  # noqa: E711
        .all()
    )
    for row in rows:
        row.actual_team = actual_team
        row.actual_score = actual_score
        reward = calculate_first_innings_reward(row.predicted_score, actual_score)
        if reward > 0:
            row.coins_won = reward
            apply_credit(
                db, row.user_id, row.stake + reward,
                "first_innings_win",
                idempotency_key=f"fi_win:{row.id}",
                ref_type="match", ref_id=str(row.match_id),
            )
        else:
            row.coins_won = -row.stake


def _fi_row_to_item(row: FirstInningsPick) -> "FirstInningsPickItem":
    from schemas import FirstInningsPickItem
    settled = row.actual_score is not None
    return FirstInningsPickItem(
        predicted_team=row.predicted_team,
        predicted_score=row.predicted_score,
        stake=row.stake,
        actual_team=row.actual_team,
        actual_score=row.actual_score,
        coins_won=row.coins_won,
        pending=not settled,
        settled=settled,
    )


def _fi_next_stake(pick_count: int) -> int | None:
    if pick_count >= MAX_FIRST_INNINGS_PICKS:
        return None
    return ENTRY_COINS


def _fi_status_from_rows(rows: list) -> "FirstInningsStatusResponse":
    from schemas import FirstInningsStatusResponse
    pick_count = len(rows)
    return FirstInningsStatusResponse(
        played=pick_count > 0,
        picks=[_fi_row_to_item(r) for r in rows],
        pick_count=pick_count,
        next_stake=_fi_next_stake(pick_count),
    )


def _fi_pick_response_from_rows(rows: list, user: User) -> "FirstInningsPickResponse":
    from schemas import FirstInningsPickResponse
    pick_count = len(rows)
    return FirstInningsPickResponse(
        picks=[_fi_row_to_item(r) for r in rows],
        pick_count=pick_count,
        next_stake=_fi_next_stake(pick_count),
        coins_balance=user.coins,
    )


@router.get("/{match_id}/first-innings-status", response_model=FirstInningsStatusResponse)
def get_first_innings_status(match_id: str, google_id: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    rows = (
        db.query(FirstInningsPick)
        .filter(FirstInningsPick.user_id == user.id, FirstInningsPick.match_id == match.id)
        .order_by(FirstInningsPick.created_at)
        .all()
    )

    if rows and any(r.actual_score is None for r in rows) and match.cricapi_id:
        _settle_first_innings_picks(db, match)
        try:
            db.commit()
        except Exception:
            db.rollback()
        for r in rows:
            db.refresh(r)

    return _fi_status_from_rows(rows)


@router.post("/{match_id}/first-innings-pick", response_model=FirstInningsPickResponse)
def play_first_innings(
    match_id: str,
    body: FirstInningsPickRequest,
    google_id: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not (50 <= body.predicted_score <= 350):
        raise HTTPException(status_code=400, detail="predicted_score must be between 50 and 350")

    now = datetime.now(timezone.utc)
    lock_time = match.start_time if match.start_time.tzinfo else match.start_time.replace(tzinfo=timezone.utc)
    if now >= lock_time:
        raise HTTPException(status_code=400, detail="First innings prediction is locked")

    existing_rows = (
        db.query(FirstInningsPick)
        .filter(FirstInningsPick.user_id == user.id, FirstInningsPick.match_id == match.id)
        .order_by(FirstInningsPick.created_at)
        .all()
    )

    # Try settling any unsettled picks before checking count
    if existing_rows and any(r.actual_score is None for r in existing_rows) and match.cricapi_id:
        _settle_first_innings_picks(db, match)
        try:
            db.commit()
        except Exception:
            db.rollback()
        for r in existing_rows:
            db.refresh(r)
        db.refresh(user)

    pick_count = len(existing_rows)
    if pick_count >= MAX_FIRST_INNINGS_PICKS:
        raise HTTPException(status_code=400, detail="max_guesses_reached")

    stake = ENTRY_COINS

    if user.coins < stake:
        raise HTTPException(status_code=400, detail="insufficient_coins")

    row = FirstInningsPick(
        user_id=user.id,
        match_id=match.id,
        predicted_team=None,
        predicted_score=body.predicted_score,
        stake=stake,
    )
    db.add(row)
    db.flush()

    try:
        apply_debit(
            db, user.id, stake, "first_innings_stake",
            idempotency_key=f"fi_stake:{row.id}",
            ref_type="match", ref_id=str(match.id),
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="insufficient_coins")

    db.commit()
    db.refresh(user)
    db.refresh(row)
    all_rows = existing_rows + [row]
    return _fi_pick_response_from_rows(all_rows, user)
