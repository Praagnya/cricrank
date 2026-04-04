from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone
from database import get_db
from models import Match, Prediction, User, MatchStatus, Challenge, calculate_points, POST_TOSS_MULTIPLIER
from schemas import PredictionCreate, PredictionPublic, PredictionWithMatch
from coin_ledger import apply_credit

router = APIRouter()


@router.post("/", response_model=PredictionPublic)
def submit_prediction(
    payload: PredictionCreate,
    google_id: str,
    db: Session = Depends(get_db),
):
    """
    Submit or update a prediction.
    - google_id passed as query param (from frontend session)
    - Locked after toss_time
    """
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    match = db.query(Match).filter(Match.id == str(payload.match_id)).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if match.status == MatchStatus.completed:
        raise HTTPException(status_code=400, detail="Match already completed")

    now = datetime.now(timezone.utc)
    is_post_toss = now >= match.toss_time

    # Block predictions once match is live or has started
    if match.status == MatchStatus.live or now >= match.start_time:
        raise HTTPException(status_code=400, detail="Match is live — predictions closed")

    if payload.selected_team not in (match.team1, match.team2):
        raise HTTPException(
            status_code=400,
            detail=f"selected_team must be '{match.team1}' or '{match.team2}'"
        )

    # Upsert — update if exists, create if not
    existing = db.query(Prediction).filter(
        Prediction.user_id == user.id,
        Prediction.match_id == match.id,
    ).first()

    if existing:
        existing.selected_team = payload.selected_team
        existing.is_post_toss = is_post_toss
        db.commit()
        db.refresh(existing)
        return existing

    prediction = Prediction(
        user_id=user.id,
        match_id=match.id,
        selected_team=payload.selected_team,
        is_post_toss=is_post_toss,
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)

    # Increment total_predictions
    user.total_predictions += 1
    db.commit()

    return prediction


@router.get("/user/{google_id}", response_model=list[PredictionWithMatch])
def user_predictions(google_id: str, db: Session = Depends(get_db)):
    """All predictions made by a user with joined match details."""
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Join Match to avoid N+1 queries when sending to frontend
    predictions = (
        db.query(Prediction)
        .options(joinedload(Prediction.match))
        .filter(Prediction.user_id == user.id)
        .order_by(Prediction.created_at.desc())
        .all()
    )
    
    return predictions


def _settle_match_internal(db: Session, match: Match) -> dict:
    """
    Core settlement logic shared by the HTTP endpoint and the background poller.
    Assumes match.winner is already set and match.status == MatchStatus.completed.
    Idempotent: skips predictions already settled (is_correct not None) and
    challenges already in a terminal status.
    """
    winner = match.winner
    mid = match.id

    predictions = db.query(Prediction).filter(Prediction.match_id == mid).all()
    updated = 0
    for pred in predictions:
        if pred.is_correct is not None:
            continue
        user = db.query(User).filter(User.id == pred.user_id).first()
        if not user:
            continue

        user.settled_predictions += 1
        if pred.selected_team == winner:
            pred.is_correct = 1
            user.current_streak += 1
            user.correct_predictions += 1
            if user.current_streak > user.longest_streak:
                user.longest_streak = user.current_streak
            pts = calculate_points(user.current_streak)
            if pred.is_post_toss:
                pts = int(pts * POST_TOSS_MULTIPLIER)
            pred.points_awarded = pts
            user.points += pts
        else:
            pred.is_correct = 0
            user.current_streak = 0
            pred.points_awarded = 0
        updated += 1

    db.commit()

    challenges_settled = 0
    challenges_expired = 0
    now = datetime.now(timezone.utc)

    accepted_challenges = (
        db.query(Challenge)
        .filter(Challenge.match_id == mid, Challenge.status == "accepted")
        .all()
    )
    for c in accepted_challenges:
        if c.challenger_team == winner:
            winner_id = c.challenger_id
        else:
            winner_id = c.acceptor_id
        if winner_id is None:
            continue
        try:
            apply_credit(db, winner_id, c.challenger_wants, "challenge_win", f"chal_{c.id}_settle")
        except Exception:
            pass
        c.winner_id = winner_id
        c.status = "settled"
        c.settled_at = now
        challenges_settled += 1

    open_challenges = (
        db.query(Challenge)
        .filter(
            Challenge.match_id == mid,
            Challenge.status.in_(["open", "counter_offered"]),
        )
        .all()
    )
    for c in open_challenges:
        try:
            apply_credit(db, c.challenger_id, c.challenger_stake, "challenge_refund", f"chal_{c.id}_refund")
        except Exception:
            pass
        c.status = "expired"
        challenges_expired += 1

    db.commit()

    return {
        "predictions_updated": updated,
        "challenges_settled": challenges_settled,
        "challenges_expired": challenges_expired,
    }


@router.post("/settle/{match_id}")
def settle_match(match_id: str, winner: str, result_summary: str | None = None, db: Session = Depends(get_db)):
    """
    Admin endpoint — called when a match result is known.
    Sets the winner, marks match completed, awards points to correct predictors.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if winner not in (match.team1, match.team2):
        raise HTTPException(
            status_code=400,
            detail=f"winner must be '{match.team1}' or '{match.team2}'",
        )

    match.winner = winner
    match.status = MatchStatus.completed
    if result_summary:
        match.result_summary = result_summary
    db.commit()

    result = _settle_match_internal(db, match)
    return {"settled": True, "winner": winner, **result}
