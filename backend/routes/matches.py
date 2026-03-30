from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
from database import get_db
from models import Match, Prediction, MatchStatus
from schemas import MatchPublic, AIPredictionResponse
from prediction_agent import get_prediction_safe

router = APIRouter()


@router.get("/", response_model=list[MatchPublic])
def list_matches(
    league: str = Query(None),
    season: str = Query(None),
    status: MatchStatus = Query(None),
    db: Session = Depends(get_db),
):
    """List matches with optional filters."""
    q = db.query(Match)
    if league:
        q = q.filter(Match.league == league)
    if season:
        q = q.filter(Match.season == season)
    if status:
        q = q.filter(Match.status == status)
    return q.order_by(Match.start_time).all()


@router.get("/today", response_model=list[MatchPublic])
def today_matches(db: Session = Depends(get_db)):
    """Return all matches starting today (IST date)."""
    now = datetime.now(timezone.utc)
    q = db.query(Match).filter(
        func.date(Match.start_time) == func.date(now),
    ).order_by(Match.start_time)
    return q.all()


@router.get("/upcoming", response_model=list[MatchPublic])
def upcoming_matches(
    limit: int = Query(10, le=20),
    days: int = Query(None, ge=1, le=30),
    db: Session = Depends(get_db),
):
    """Return next N upcoming matches, optionally within the next `days` days."""
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    q = (
        db.query(Match)
        .filter(Match.start_time >= now, Match.status == MatchStatus.upcoming)
    )
    if days is not None:
        cutoff = now + timedelta(days=days)
        q = q.filter(Match.start_time <= cutoff)
    return q.order_by(Match.start_time).limit(limit).all()


@router.get("/{match_id}", response_model=MatchPublic)
def get_match(match_id: str, db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return match


@router.get("/{match_id}/prediction", response_model=AIPredictionResponse)
def get_ai_prediction(match_id: str, db: Session = Depends(get_db)):
    """Run the AI agent to predict the match result."""
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
    """Return crowd prediction percentages based on user predictions."""
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
