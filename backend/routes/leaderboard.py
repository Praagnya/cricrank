from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import User, ContestEntry, Follow
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
        .order_by(
            desc(User.points),
            desc(User.correct_predictions * 1.0 / func.nullif(User.settled_predictions, 0)),
            desc(User.current_streak),
        )
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
            settled_predictions=u.settled_predictions,
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
        .order_by(desc("period_points"), desc("period_settled"), desc("period_correct"))
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
            settled_predictions=settled or 0,
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



@router.get("/following/{google_id}", response_model=list[LeaderboardEntry])
def following_leaderboard(google_id: str, db: Session = Depends(get_db)):
    """Leaderboard of users you follow, including yourself."""
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        return []

    following_ids = [
        f.following_id for f in db.query(Follow).filter(Follow.follower_id == user.id).all()
    ]
    # Include the viewer themselves
    ids = list(set(following_ids + [user.id]))

    users = (
        db.query(User)
        .filter(User.id.in_(ids), User.total_predictions > 0)
        .order_by(
            desc(User.points),
            desc(User.correct_predictions * 1.0 / func.nullif(User.settled_predictions, 0)),
            desc(User.current_streak),
        )
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
            settled_predictions=u.settled_predictions,
            correct_predictions=u.correct_predictions,
            current_streak=u.current_streak,
            streak_tier=u.streak_tier,
            jersey_number=u.jersey_number,
            jersey_color=u.jersey_color,
        )
        for i, u in enumerate(users)
    ]


@router.get("/rank/{google_id}", response_model=LeaderboardEntry | None)
def my_rank(
    google_id: str,
    period: str = Query("alltime"),
    db: Session = Depends(get_db),
):
    """Return a single user's rank entry regardless of their position."""
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        return None

    if period == "alltime":
        if user.total_predictions == 0:
            return None
        rank = db.query(func.count(User.id)).filter(
            User.total_predictions > 0,
            User.points > user.points,
        ).scalar() + 1
        return LeaderboardEntry(
            google_id=user.google_id,
            rank=rank,
            name=user.name,
            points=user.points,
            accuracy=user.accuracy,
            total_predictions=user.total_predictions,
            settled_predictions=user.settled_predictions,
            correct_predictions=user.correct_predictions,
            current_streak=user.current_streak,
            streak_tier=user.streak_tier,
            jersey_number=user.jersey_number,
            jersey_color=user.jersey_color,
        )

    days = 7 if period == "weekly" else 30
    min_date = datetime.now(timezone.utc) - timedelta(days=days)

    user_pts = (
        db.query(func.sum(Prediction.points_awarded))
        .filter(Prediction.user_id == user.id, Prediction.created_at >= min_date)
        .scalar() or 0
    )
    has_preds = db.query(Prediction).filter(
        Prediction.user_id == user.id, Prediction.created_at >= min_date
    ).first()
    if not has_preds:
        return None

    higher = (
        db.query(Prediction.user_id)
        .filter(Prediction.created_at >= min_date)
        .group_by(Prediction.user_id)
        .having(func.sum(Prediction.points_awarded) > user_pts)
        .subquery()
    )
    rank = db.query(func.count()).select_from(higher).scalar() + 1

    stats = (
        db.query(
            func.sum(Prediction.points_awarded).label("pts"),
            func.count(Prediction.id).label("total"),
            func.count(Prediction.is_correct).label("settled"),
            func.sum(Prediction.is_correct).label("correct"),
        )
        .filter(Prediction.user_id == user.id, Prediction.created_at >= min_date)
        .first()
    )
    pts, total, settled, correct = stats.pts or 0, stats.total or 0, stats.settled or 0, stats.correct or 0
    return LeaderboardEntry(
        google_id=user.google_id,
        rank=rank,
        name=user.name,
        points=pts,
        accuracy=round((correct / settled * 100), 1) if (settled and correct) else 0.0,
        total_predictions=total,
        settled_predictions=settled,
        correct_predictions=correct,
        current_streak=user.current_streak,
        streak_tier=user.streak_tier,
        jersey_number=user.jersey_number,
        jersey_color=user.jersey_color,
    )


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
