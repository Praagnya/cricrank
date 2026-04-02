import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Challenge, Match, User, MatchStatus
from schemas import (
    ChallengeCreate,
    ChallengePublic,
    ChallengeListResponse,
    ChallengeCounterRequest,
    ChallengeUserPublic,
)
from coin_ledger import apply_debit, apply_credit

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_user_public(user: Optional[User]) -> Optional[ChallengeUserPublic]:
    if user is None:
        return None
    return ChallengeUserPublic(
        google_id=user.google_id,
        username=user.username,
        name=user.name,
        avatar_url=user.avatar_url,
    )


def _to_public(c: Challenge) -> ChallengePublic:
    return ChallengePublic(
        id=c.id,
        match_id=c.match_id,
        share_token=c.share_token,
        status=c.status,
        challenger_team=c.challenger_team,
        challenger_stake=c.challenger_stake,
        challenger_wants=c.challenger_wants,
        acceptor_stake=c.challenger_wants - c.challenger_stake,
        challenger=_build_user_public(c.challenger),
        acceptor=_build_user_public(c.acceptor),
        invited_user=_build_user_public(c.invited_user),
        match=c.match,
        counter_challenger_stake=c.counter_challenger_stake,
        counter_challenger_wants=c.counter_challenger_wants,
        created_at=c.created_at,
        expires_at=c.expires_at,
    )


def _load_challenge(challenge_id: str, db: Session) -> Challenge:
    c = (
        db.query(Challenge)
        .options(
            joinedload(Challenge.challenger),
            joinedload(Challenge.acceptor),
            joinedload(Challenge.invited_user),
            joinedload(Challenge.match),
        )
        .filter(Challenge.id == challenge_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return c


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/", response_model=ChallengePublic)
def create_challenge(
    payload: ChallengeCreate,
    google_id: str,
    db: Session = Depends(get_db),
):
    """Create a new open challenge. Debits challenger_stake to escrow."""
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    match = db.query(Match).filter(Match.id == str(payload.match_id)).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if match.status != MatchStatus.upcoming:
        raise HTTPException(status_code=400, detail="Can only challenge on upcoming matches")

    now = datetime.now(timezone.utc)
    if now >= match.start_time:
        raise HTTPException(status_code=400, detail="Match has already started")

    if payload.challenger_stake <= 0:
        raise HTTPException(status_code=400, detail="challenger_stake must be positive")
    if payload.challenger_wants <= payload.challenger_stake:
        raise HTTPException(status_code=400, detail="challenger_wants must be greater than challenger_stake")
    if payload.challenger_team not in (match.team1, match.team2):
        raise HTTPException(
            status_code=400,
            detail=f"challenger_team must be '{match.team1}' or '{match.team2}'"
        )

    invited_user_id = None
    if payload.invited_google_id:
        invited = db.query(User).filter(User.google_id == payload.invited_google_id).first()
        if not invited:
            raise HTTPException(status_code=404, detail="Invited user not found")
        if invited.id == user.id:
            raise HTTPException(status_code=400, detail="Cannot invite yourself")
        invited_user_id = invited.id

    token = secrets.token_urlsafe(10)

    c = Challenge(
        match_id=match.id,
        challenger_id=user.id,
        challenger_team=payload.challenger_team,
        challenger_stake=payload.challenger_stake,
        challenger_wants=payload.challenger_wants,
        invited_user_id=invited_user_id,
        share_token=token,
        status="open",
        expires_at=match.start_time,
    )
    db.add(c)
    db.flush()  # get c.id before coin ledger call

    try:
        apply_debit(
            db,
            user.id,
            payload.challenger_stake,
            "challenge_escrow",
            f"chal_{c.id}_challenger",
        )
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    db.commit()
    db.refresh(c)

    # Eager-load relations for response
    c = _load_challenge(str(c.id), db)
    return _to_public(c)


@router.get("/token/{token}", response_model=ChallengePublic)
def get_by_token(token: str, db: Session = Depends(get_db)):
    """Fetch a challenge by its share token (deep link)."""
    c = (
        db.query(Challenge)
        .options(
            joinedload(Challenge.challenger),
            joinedload(Challenge.acceptor),
            joinedload(Challenge.invited_user),
            joinedload(Challenge.match),
        )
        .filter(Challenge.share_token == token)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return _to_public(c)


@router.get("/user/{google_id}", response_model=ChallengeListResponse)
def list_user_challenges(
    google_id: str,
    db: Session = Depends(get_db),
):
    """List all challenges where user is challenger or acceptor. Returns pending_count for badge."""
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    challenges = (
        db.query(Challenge)
        .options(
            joinedload(Challenge.challenger),
            joinedload(Challenge.acceptor),
            joinedload(Challenge.invited_user),
            joinedload(Challenge.match),
        )
        .filter(
            (Challenge.challenger_id == user.id) |
            (Challenge.acceptor_id == user.id) |
            (Challenge.invited_user_id == user.id)
        )
        .order_by(Challenge.created_at.desc())
        .all()
    )

    # pending = challenges the user needs to act on:
    # - invited (open, user hasn't accepted yet)
    # - counter offer received (user is challenger, status=counter_offered)
    pending_count = sum(
        1 for ch in challenges
        if (
            (ch.invited_user_id == user.id and ch.status == "open") or
            (ch.challenger_id == user.id and ch.status == "counter_offered")
        )
    )

    return ChallengeListResponse(
        challenges=[_to_public(c) for c in challenges],
        pending_count=pending_count,
    )


@router.get("/pending-count/{google_id}")
def pending_count(google_id: str, db: Session = Depends(get_db)):
    """Lightweight count for notification badge."""
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        return {"count": 0}

    # Invited to open challenges not yet accepted
    count = (
        db.query(Challenge)
        .filter(
            Challenge.invited_user_id == user.id,
            Challenge.status == "open",
        )
        .count()
    )
    # Counter offers waiting on challenger
    count += (
        db.query(Challenge)
        .filter(
            Challenge.challenger_id == user.id,
            Challenge.status == "counter_offered",
        )
        .count()
    )
    return {"count": count}


@router.get("/open", response_model=list[ChallengePublic])
def list_open_challenges(
    google_id: Optional[str] = None,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """
    Public feed of open challenges anyone can join.
    Excludes challenges created by the viewer and expired ones.
    """
    now = datetime.now(timezone.utc)

    q = (
        db.query(Challenge)
        .options(
            joinedload(Challenge.challenger),
            joinedload(Challenge.acceptor),
            joinedload(Challenge.invited_user),
            joinedload(Challenge.match),
        )
        .filter(
            Challenge.status == "open",
            Challenge.expires_at > now,
        )
    )

    if google_id:
        viewer = db.query(User).filter(User.google_id == google_id).first()
        if viewer:
            q = q.filter(Challenge.challenger_id != viewer.id)

    challenges = q.order_by(Challenge.created_at.desc()).limit(limit).all()
    return [_to_public(c) for c in challenges]


@router.post("/{challenge_id}/accept", response_model=ChallengePublic)
def accept_challenge(
    challenge_id: str,
    google_id: str,
    db: Session = Depends(get_db),
):
    """Accept an open challenge. Debits acceptor stake."""
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    c = _load_challenge(challenge_id, db)

    if c.status not in ("open",):
        raise HTTPException(status_code=400, detail=f"Challenge is {c.status}, cannot accept")
    if c.challenger_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot accept your own challenge")

    now = datetime.now(timezone.utc)
    if now >= c.expires_at:
        c.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Challenge has expired")

    acceptor_stake = c.challenger_wants - c.challenger_stake

    try:
        apply_debit(
            db,
            user.id,
            acceptor_stake,
            "challenge_escrow",
            f"chal_{c.id}_acceptor",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    c.acceptor_id = user.id
    c.status = "accepted"
    db.commit()

    c = _load_challenge(challenge_id, db)
    return _to_public(c)


@router.post("/{challenge_id}/counter", response_model=ChallengePublic)
def counter_challenge(
    challenge_id: str,
    google_id: str,
    payload: ChallengeCounterRequest,
    db: Session = Depends(get_db),
):
    """Acceptor proposes counter terms. No coin movement yet."""
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    c = _load_challenge(challenge_id, db)

    if c.status != "open":
        raise HTTPException(status_code=400, detail=f"Challenge is {c.status}, cannot counter")
    if c.challenger_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot counter your own challenge")

    if payload.challenger_stake <= 0:
        raise HTTPException(status_code=400, detail="challenger_stake must be positive")
    if payload.challenger_wants <= payload.challenger_stake:
        raise HTTPException(status_code=400, detail="challenger_wants must exceed challenger_stake")

    now = datetime.now(timezone.utc)
    if now >= c.expires_at:
        c.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Challenge has expired")

    c.acceptor_id = user.id
    c.counter_challenger_stake = payload.challenger_stake
    c.counter_challenger_wants = payload.challenger_wants
    c.status = "counter_offered"
    db.commit()

    c = _load_challenge(challenge_id, db)
    return _to_public(c)


@router.post("/{challenge_id}/accept-counter", response_model=ChallengePublic)
def accept_counter(
    challenge_id: str,
    google_id: str,
    db: Session = Depends(get_db),
):
    """Challenger accepts the counter offer. Adjusts escrow for new terms."""
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    c = _load_challenge(challenge_id, db)

    if c.status != "counter_offered":
        raise HTTPException(status_code=400, detail=f"No counter offer to accept")
    if c.challenger_id != user.id:
        raise HTTPException(status_code=400, detail="Only the challenger can accept the counter")
    if c.counter_challenger_stake is None or c.counter_challenger_wants is None:
        raise HTTPException(status_code=400, detail="Counter terms missing")

    now = datetime.now(timezone.utc)
    if now >= c.expires_at:
        # Refund original challenger stake and cancel
        try:
            apply_credit(db, user.id, c.challenger_stake, "challenge_refund", f"chal_{c.id}_refund")
        except Exception:
            pass
        c.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Challenge has expired")

    original_stake = c.challenger_stake
    new_stake = c.counter_challenger_stake
    new_wants = c.counter_challenger_wants
    acceptor_stake = new_wants - new_stake

    # Adjust challenger escrow: refund difference or debit more
    delta = new_stake - original_stake
    if delta > 0:
        try:
            apply_debit(db, user.id, delta, "challenge_escrow", f"chal_{c.id}_counter_top_up")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    elif delta < 0:
        apply_credit(db, user.id, abs(delta), "challenge_refund", f"chal_{c.id}_counter_refund")

    # Debit acceptor stake
    try:
        apply_debit(
            db,
            c.acceptor_id,
            acceptor_stake,
            "challenge_escrow",
            f"chal_{c.id}_acceptor",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    c.challenger_stake = new_stake
    c.challenger_wants = new_wants
    c.counter_challenger_stake = None
    c.counter_challenger_wants = None
    c.status = "accepted"
    db.commit()

    c = _load_challenge(challenge_id, db)
    return _to_public(c)


@router.post("/{challenge_id}/decline", response_model=ChallengePublic)
def decline_challenge(
    challenge_id: str,
    google_id: str,
    db: Session = Depends(get_db),
):
    """Decline an open or counter-offered challenge. Refunds challenger."""
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    c = _load_challenge(challenge_id, db)

    if c.status not in ("open", "counter_offered"):
        raise HTTPException(status_code=400, detail=f"Challenge is {c.status}, cannot decline")
    if c.challenger_id == user.id:
        raise HTTPException(status_code=400, detail="Use /cancel to withdraw your own challenge")

    try:
        apply_credit(
            db,
            c.challenger_id,
            c.challenger_stake,
            "challenge_refund",
            f"chal_{c.id}_refund",
        )
    except Exception:
        pass

    c.status = "declined"
    db.commit()

    c = _load_challenge(challenge_id, db)
    return _to_public(c)


@router.post("/{challenge_id}/cancel", response_model=ChallengePublic)
def cancel_challenge(
    challenge_id: str,
    google_id: str,
    db: Session = Depends(get_db),
):
    """Challenger cancels an open challenge before it is accepted. Refunds stake."""
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    c = _load_challenge(challenge_id, db)

    if c.challenger_id != user.id:
        raise HTTPException(status_code=403, detail="Only the challenger can cancel")
    if c.status not in ("open", "counter_offered"):
        raise HTTPException(status_code=400, detail=f"Challenge is {c.status}, cannot cancel")

    try:
        apply_credit(
            db,
            c.challenger_id,
            c.challenger_stake,
            "challenge_refund",
            f"chal_{c.id}_refund",
        )
    except Exception:
        pass

    c.status = "cancelled"
    db.commit()

    c = _load_challenge(challenge_id, db)
    return _to_public(c)


@router.post("/settle-match/{match_id}")
def settle_challenges_for_match(
    match_id: str,
    winner: str,
    db: Session = Depends(get_db),
):
    """
    Called when a match result is set. Settles all accepted challenges for that match.
    Should be called after /predictions/settle/{match_id} which sets match.winner.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if match.status != MatchStatus.completed:
        raise HTTPException(status_code=400, detail="Match not yet completed")

    accepted_challenges = (
        db.query(Challenge)
        .options(joinedload(Challenge.challenger), joinedload(Challenge.acceptor))
        .filter(Challenge.match_id == match_id, Challenge.status == "accepted")
        .all()
    )

    # Expire any still-open challenges
    open_challenges = (
        db.query(Challenge)
        .options(joinedload(Challenge.challenger))
        .filter(
            Challenge.match_id == match_id,
            Challenge.status.in_(["open", "counter_offered"]),
        )
        .all()
    )
    for c in open_challenges:
        try:
            apply_credit(
                db,
                c.challenger_id,
                c.challenger_stake,
                "challenge_refund",
                f"chal_{c.id}_refund",
            )
        except Exception:
            pass
        c.status = "expired"

    settled_count = 0
    now = datetime.now(timezone.utc)

    for c in accepted_challenges:
        # Determine winner
        acceptor_team = match.team1 if c.challenger_team == match.team2 else match.team2
        if c.challenger_team == winner:
            winner_user = c.challenger
        else:
            winner_user = c.acceptor

        if winner_user is None:
            continue

        total_pot = c.challenger_wants  # challenger wins the full pot they wanted
        try:
            apply_credit(
                db,
                winner_user.id,
                total_pot,
                "challenge_win",
                f"chal_{c.id}_settle",
            )
        except Exception:
            pass

        c.winner_id = winner_user.id
        c.status = "settled"
        c.settled_at = now
        settled_count += 1

    db.commit()
    return {
        "settled": settled_count,
        "expired": len(open_challenges),
        "match_id": match_id,
        "winner": winner,
    }
