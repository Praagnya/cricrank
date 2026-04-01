from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone
from database import get_db
from models import Match, Prediction, User, MatchStatus
from schemas import PredictionCreate, PredictionPublic, PredictionWithMatch
from settlement import apply_match_settlement

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


@router.post("/settle/{match_id}")
def settle_match(match_id: str, winner: str, result_summary: str | None = None, db: Session = Depends(get_db)):
    """
    Admin endpoint — called when a match result is known.
    Sets the winner, marks match completed, awards points to correct predictors.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    try:
        n = apply_match_settlement(db, match, winner, result_summary)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    db.commit()
    return {"settled": True, "winner": winner, "predictions_updated": n}
