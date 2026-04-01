from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from coin_ledger import apply_credit, apply_debit
from cricapi import CricAPIError, fetch_current_matches, fetch_match_bbb, fetch_match_scorecard, fetch_series_info
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
TOSS_MATCH_COINS = 100


def _merge_toss_sources(match: Match) -> dict:
    if not match.cricapi_id:
        return {}
    source = _find_current_match_payload(match.cricapi_id) or {}
    bbb: dict = {}
    try:
        bbb = fetch_match_bbb(match.cricapi_id) or {}
    except CricAPIError:
        bbb = {}
    if not isinstance(bbb, dict):
        bbb = {}
    return {**source, **bbb}


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


def _refresh_match_toss_winner(db: Session, match: Match) -> None:
    if match.toss_winner:
        return
    merged = _merge_toss_sources(match)
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
        row.coins_won = TOSS_MATCH_COINS  # net gain (+100)
        # Return stake + reward (200 total)
        apply_credit(
            db,
            row.user_id,
            TOSS_MATCH_COINS * 2,
            "toss_match",
            idempotency_key=f"toss_match:{row.user_id}:{row.match_id}",
            ref_type="match",
            ref_id=str(row.match_id),
        )
    else:
        row.coins_won = -TOSS_MATCH_COINS  # net loss (stake already deducted)


def _settle_all_toss_plays_for_match(db: Session, match: Match) -> None:
    for row in db.query(TossPlay).filter(TossPlay.match_id == match.id).all():
        if row.winning_team is None:
            _settle_toss_row(db, row, match)


def _toss_pick_response(row: TossPlay, user: User, already_played: bool) -> TossPickResponse:
    settled = row.winning_team is not None
    pending = row.picked_team is not None and not settled
    return TossPickResponse(
        picked_team=row.picked_team,
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
    now = datetime.now(timezone.utc)
    matches = db.query(Match).filter(func.date(Match.start_time) == func.date(now)).order_by(Match.start_time).all()

    changed = False
    try:
        current_by_id = {m["id"]: m for m in (fetch_current_matches() or []) if "id" in m}
    except CricAPIError:
        current_by_id = {}

    for match in matches:
        if not match.cricapi_id or match.status != MatchStatus.upcoming or match.start_time > now:
            continue
        payload = current_by_id.get(match.cricapi_id)
        if not payload:
            try:
                payload = fetch_match_bbb(match.cricapi_id) or {}
            except CricAPIError:
                continue
        if not payload:
            continue
        new_status = _match_status_from_payload(payload)
        if new_status != match.status:
            match.status = new_status
            changed = True
        if new_status == MatchStatus.completed and payload.get("status") and not match.result_summary:
            match.result_summary = payload["status"]
            changed = True

    if changed:
        db.commit()

    return matches


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

    if user.coins < TOSS_MATCH_COINS:
        raise HTTPException(status_code=400, detail="insufficient_coins")

    row = TossPlay(
        user_id=user.id,
        match_id=match.id,
        picked_team=picked,
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
            TOSS_MATCH_COINS,
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

    current_payload = _find_current_match_payload(match.cricapi_id)
    bbb_payload: dict = {}
    if current_payload and (current_payload.get("matchStarted") or current_payload.get("matchEnded")):
        try:
            bbb_payload = fetch_match_bbb(match.cricapi_id) or {}
        except CricAPIError:
            bbb_payload = {}

    source = bbb_payload or current_payload or {}
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

    _refresh_match_toss_winner(db, match)
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
        bbb=bbb_payload.get("bbb") or [],
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

    # Scorecard API may not have data for live matches — fall back to BBB
    if not payload.get("scorecard") and match.status in (MatchStatus.live, MatchStatus.completed):
        try:
            payload = fetch_match_bbb(match.cricapi_id) or payload
        except CricAPIError:
            pass

    if not payload:
        raise HTTPException(status_code=502, detail="Scorecard not available")

    return MatchScorecardResponse(
        match_id=match.id,
        cricapi_id=match.cricapi_id,
        score=payload.get("score") or [],
        scorecard=payload.get("scorecard") or [],
    )


# ── First Innings Score ────────────────────────────────────────────────────────

FIRST_INNINGS_STAKE = 10
FIRST_INNINGS_PRIZE = 10_000   # net gain on exact match


def _get_first_innings_result(cricapi_id: str) -> tuple[str | None, int | None]:
    """
    Returns (batting_team, runs) when first innings is complete, else (None, None).
    Tries BBB first (most up-to-date), then currentMatches.
    """
    for fetch_fn in (lambda: fetch_match_bbb(cricapi_id), lambda: _find_current_match_payload(cricapi_id) or {}):
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
        correct = row.predicted_team == actual_team and row.predicted_score == actual_score
        if correct:
            row.coins_won = FIRST_INNINGS_PRIZE
            apply_credit(
                db, row.user_id, FIRST_INNINGS_STAKE + FIRST_INNINGS_PRIZE,
                "first_innings_win",
                idempotency_key=f"fi_win:{row.user_id}:{row.match_id}",
                ref_type="match", ref_id=str(row.match_id),
            )
        else:
            row.coins_won = -FIRST_INNINGS_STAKE


def _fi_status_response(row: FirstInningsPick) -> FirstInningsStatusResponse:
    settled = row.actual_score is not None
    return FirstInningsStatusResponse(
        played=True,
        predicted_team=row.predicted_team,
        predicted_score=row.predicted_score,
        actual_team=row.actual_team,
        actual_score=row.actual_score,
        coins_won=row.coins_won,
        pending=not settled,
        settled=settled,
    )


def _fi_pick_response(row: FirstInningsPick, user: User, already_played: bool) -> FirstInningsPickResponse:
    settled = row.actual_score is not None
    return FirstInningsPickResponse(
        predicted_team=row.predicted_team,
        predicted_score=row.predicted_score,
        actual_team=row.actual_team,
        actual_score=row.actual_score,
        coins_won=row.coins_won,
        coins_balance=user.coins,
        already_played=already_played,
        pending=not settled,
        settled=settled,
    )


@router.get("/{match_id}/first-innings-status", response_model=FirstInningsStatusResponse)
def get_first_innings_status(match_id: str, google_id: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    row = db.query(FirstInningsPick).filter(
        FirstInningsPick.user_id == user.id, FirstInningsPick.match_id == match.id
    ).first()

    if row and row.actual_score is None and match.cricapi_id:
        _settle_first_innings_picks(db, match)
        try:
            db.commit()
        except Exception:
            db.rollback()
        db.refresh(row)

    if not row:
        return FirstInningsStatusResponse(played=False)
    return _fi_status_response(row)


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

    picked_team = canonicalize_team(body.predicted_team)
    if picked_team not in (match.team1, match.team2):
        raise HTTPException(status_code=400, detail="predicted_team must be one of the two sides")
    if not (50 <= body.predicted_score <= 350):
        raise HTTPException(status_code=400, detail="predicted_score must be between 50 and 350")

    existing = db.query(FirstInningsPick).filter(
        FirstInningsPick.user_id == user.id, FirstInningsPick.match_id == match.id
    ).first()
    if existing:
        if existing.actual_score is None and match.cricapi_id:
            _settle_first_innings_picks(db, match)
            try:
                db.commit()
            except Exception:
                db.rollback()
            db.refresh(existing)
            db.refresh(user)
        return _fi_pick_response(existing, user, True)

    now = datetime.now(timezone.utc)
    lock_time = match.start_time if match.start_time.tzinfo else match.start_time.replace(tzinfo=timezone.utc)
    if now >= lock_time:
        raise HTTPException(status_code=400, detail="First innings prediction is locked")

    if user.coins < FIRST_INNINGS_STAKE:
        raise HTTPException(status_code=400, detail="insufficient_coins")

    row = FirstInningsPick(
        user_id=user.id,
        match_id=match.id,
        predicted_team=picked_team,
        predicted_score=body.predicted_score,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        existing = db.query(FirstInningsPick).filter(
            FirstInningsPick.user_id == user.id, FirstInningsPick.match_id == match.id
        ).first()
        if not existing:
            raise HTTPException(status_code=409, detail="Could not record pick") from None
        db.refresh(user)
        return _fi_pick_response(existing, user, True)

    try:
        apply_debit(
            db, user.id, FIRST_INNINGS_STAKE, "first_innings_stake",
            idempotency_key=f"fi_stake:{user.id}:{match.id}",
            ref_type="match", ref_id=str(match.id),
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="insufficient_coins")

    db.commit()
    db.refresh(user)
    db.refresh(row)
    return _fi_pick_response(row, user, False)
