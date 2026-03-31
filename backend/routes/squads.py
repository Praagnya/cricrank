import random
import string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from database import get_db
from models import User, Squad, SquadMember, Prediction
from schemas import SquadPublic, SquadCreate, LeaderboardEntry

router = APIRouter()

MAX_SQUADS_PER_USER = 5


def _generate_invite_code(db: Session) -> str:
    chars = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choices(chars, k=6))
        if not db.query(Squad).filter(Squad.invite_code == code).first():
            return code


def _squad_to_public(squad: Squad, user_id, db: Session) -> SquadPublic:
    count = db.query(func.count(SquadMember.id)).filter(SquadMember.squad_id == squad.id).scalar()
    return SquadPublic(
        id=squad.id,
        name=squad.name,
        invite_code=squad.invite_code,
        member_count=count,
        is_creator=(squad.creator_id == user_id),
    )


@router.post("/", response_model=SquadPublic)
def create_squad(payload: SquadCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.google_id == payload.google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        db.query(Squad)
        .join(SquadMember, SquadMember.squad_id == Squad.id)
        .filter(SquadMember.user_id == user.id)
        .count()
    )
    if existing >= MAX_SQUADS_PER_USER:
        raise HTTPException(status_code=400, detail="Maximum 5 squads allowed")

    name = payload.name.strip()
    if not name or len(name) > 30:
        raise HTTPException(status_code=400, detail="Squad name must be 1–30 characters")

    squad = Squad(
        name=name,
        creator_id=user.id,
        invite_code=_generate_invite_code(db),
    )
    db.add(squad)
    db.flush()

    member = SquadMember(squad_id=squad.id, user_id=user.id)
    db.add(member)
    db.commit()
    db.refresh(squad)

    return _squad_to_public(squad, user.id, db)


@router.post("/join/{invite_code}", response_model=SquadPublic)
def join_squad(invite_code: str, google_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    squad = db.query(Squad).filter(Squad.invite_code == invite_code.upper()).first()
    if not squad:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    already = db.query(SquadMember).filter(
        SquadMember.squad_id == squad.id, SquadMember.user_id == user.id
    ).first()
    if already:
        raise HTTPException(status_code=409, detail="Already in this squad")

    existing = (
        db.query(Squad)
        .join(SquadMember, SquadMember.squad_id == Squad.id)
        .filter(SquadMember.user_id == user.id)
        .count()
    )
    if existing >= MAX_SQUADS_PER_USER:
        raise HTTPException(status_code=400, detail="Maximum 5 squads allowed")

    db.add(SquadMember(squad_id=squad.id, user_id=user.id))
    db.commit()

    return _squad_to_public(squad, user.id, db)


@router.delete("/{squad_id}/leave")
def leave_squad(squad_id: str, google_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    member = db.query(SquadMember).join(Squad).filter(
        Squad.id == squad_id, SquadMember.user_id == user.id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Not a member")

    squad = db.query(Squad).filter(Squad.id == squad_id).first()
    db.delete(member)

    # If creator leaves and no members remain, delete squad
    remaining = db.query(SquadMember).filter(SquadMember.squad_id == squad_id).count()
    if remaining == 0:
        db.delete(squad)

    db.commit()
    return {"ok": True}


@router.get("/my/{google_id}", response_model=list[SquadPublic])
def my_squads(google_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    squads = (
        db.query(Squad)
        .join(SquadMember, SquadMember.squad_id == Squad.id)
        .filter(SquadMember.user_id == user.id)
        .all()
    )
    return [_squad_to_public(s, user.id, db) for s in squads]


@router.get("/{squad_id}/leaderboard", response_model=list[LeaderboardEntry])
def squad_leaderboard(squad_id: str, db: Session = Depends(get_db)):
    member_ids = [
        m.user_id for m in db.query(SquadMember).filter(SquadMember.squad_id == squad_id).all()
    ]
    if not member_ids:
        return []

    users = (
        db.query(User)
        .filter(User.id.in_(member_ids), User.total_predictions > 0)
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
