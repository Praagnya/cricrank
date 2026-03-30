from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import User, ContestEntry, Contest
from schemas import LeaderboardEntry, ContestLeaderboardEntry

router = APIRouter()


@router.get("/global", response_model=list[LeaderboardEntry])
def global_leaderboard(
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
):
    """Global all-time leaderboard ranked by points, then accuracy."""
    users = (
        db.query(User)
        .filter(User.total_predictions > 0)
        .order_by(desc(User.points), desc(User.correct_predictions))
        .limit(limit)
        .all()
    )

    return [
        LeaderboardEntry(
            google_id=u.google_id,
            rank=i + 1,
            name=u.name,
            points=u.points,
            accuracy=u.accuracy,
            total_predictions=u.total_predictions,
            correct_predictions=u.correct_predictions,
            current_streak=u.current_streak,
            streak_tier=u.streak_tier,
            jersey_number=u.jersey_number,
            jersey_color=u.jersey_color,
        )
        for i, u in enumerate(users)
    ]

from datetime import datetime, timezone, timedelta
from sqlalchemy import func
from models import Prediction

def dynamic_leaderboard(db: Session, limit: int, days: int):
    min_date = datetime.now(timezone.utc) - timedelta(days=days)
    results = (
        db.query(
            User,
            func.sum(Prediction.points_awarded).label("period_points"),
            func.count(Prediction.id).label("period_total"),
            func.count(Prediction.is_correct).label("period_settled"),
            func.sum(Prediction.is_correct).label("period_correct")
        )
        .join(Prediction, User.id == Prediction.user_id)
        .filter(Prediction.created_at >= min_date)
        .group_by(User.id)
        .order_by(desc("period_points"), desc("period_correct"))
        .limit(limit)
        .all()
    )

    return [
        LeaderboardEntry(
            google_id=user.google_id,
            rank=i + 1,
            name=user.name,
            points=points or 0,
            accuracy=round((correct / settled * 100), 1) if (settled and correct) else 0.0,
            total_predictions=total or 0,
            correct_predictions=correct or 0,
            current_streak=user.current_streak,
            streak_tier=user.streak_tier,
            jersey_number=user.jersey_number,
            jersey_color=user.jersey_color,
        )
        for i, (user, points, total, settled, correct) in enumerate(results)
    ]

@router.get("/weekly", response_model=list[LeaderboardEntry])
def weekly_leaderboard(limit: int = Query(50, le=100), db: Session = Depends(get_db)):
    return dynamic_leaderboard(db, limit, 7)

@router.get("/monthly", response_model=list[LeaderboardEntry])
def monthly_leaderboard(limit: int = Query(50, le=100), db: Session = Depends(get_db)):
    return dynamic_leaderboard(db, limit, 30)



@router.get("/contest/{contest_id}", response_model=list[ContestLeaderboardEntry])
def contest_leaderboard(
    contest_id: str,
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
):
    """Leaderboard for a specific contest (weekly/monthly/tournament)."""
    entries = (
        db.query(ContestEntry, User)
        .join(User, ContestEntry.user_id == User.id)
        .filter(ContestEntry.contest_id == contest_id)
        .order_by(desc(ContestEntry.points))
        .limit(limit)
        .all()
    )

    return [
        ContestLeaderboardEntry(
            rank=i + 1,
            name=user.name,
            points=entry.points,
            accuracy=user.accuracy,
        )
        for i, (entry, user) in enumerate(entries)
    ]
