from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from cricapi import CricAPIError, fetch_current_matches, fetch_match_bbb, fetch_match_scorecard, fetch_series_info
from database import get_db
from models import Match, MatchStatus, Prediction
from prediction_agent import get_prediction_safe
from schemas import (
    AIPredictionResponse,
    MatchLiveResponse,
    MatchPublic,
    MatchScorecardResponse,
    SeriesSyncRequest,
    SeriesSyncResponse,
)
from team_metadata import canonicalize_team, canonicalize_winner, league_aliases, normalize_team_pair

router = APIRouter()


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
    q = db.query(Match).filter(func.date(Match.start_time) == func.date(now)).order_by(Match.start_time)
    return q.all()


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

    return MatchLiveResponse(
        match_id=match.id,
        cricapi_id=match.cricapi_id,
        status=status,
        match_started=match_started,
        match_ended=match_ended,
        status_text=status_text,
        match_winner=match_winner,
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

    try:
        payload = fetch_match_scorecard(match.cricapi_id)
    except CricAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return MatchScorecardResponse(
        match_id=match.id,
        cricapi_id=match.cricapi_id,
        score=payload.get("score") or [],
        scorecard=payload.get("scorecard") or [],
    )
