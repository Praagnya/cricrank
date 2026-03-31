from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
import random
from database import get_db
from models import User, Follow, JERSEY_COLORS
from schemas import UserCreate, UserPublic, UserIdentityUpdate, FollowStats, FollowUserPublic

router = APIRouter()


@router.post("/", response_model=UserPublic)
def upsert_user(payload: UserCreate, db: Session = Depends(get_db)):
    """
    Called after Google OAuth login.
    Creates the user if new, returns existing user if already registered.
    """
    user = db.query(User).filter(User.google_id == payload.google_id).first()

    if not user:
        # Deduplicate name if taken (e.g. two Google accounts with same full name)
        base_name = payload.name
        name = base_name
        suffix = 2
        while db.query(User).filter(User.name == name).first():
            name = f"{base_name} {suffix}"
            suffix += 1

        user = User(
            google_id=payload.google_id,
            name=name,
            email=payload.email,
            avatar_url=payload.avatar_url,
            jersey_number=random.randint(1, 99),
            jersey_color=random.choice(JERSEY_COLORS),
        )
        db.add(user)
    else:
        # Don't overwrite name — user may have set a custom display name
        user.email = payload.email
        if payload.avatar_url:
            user.avatar_url = payload.avatar_url

    db.commit()
    db.refresh(user)

    return user


@router.get("/{google_id}", response_model=UserPublic)
def get_user(google_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{google_id}/identity", response_model=UserPublic)
def update_identity(
    google_id: str,
    payload: UserIdentityUpdate,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if payload.jersey_number < 1 or payload.jersey_number > 999:
        raise HTTPException(status_code=400, detail="Jersey number must be between 1 and 999")

    if payload.display_name is not None:
        name = payload.display_name.strip()
        if not name or len(name) > 30:
            raise HTTPException(status_code=400, detail="Display name must be 1–30 characters")
        taken = db.query(User).filter(User.name == name, User.google_id != google_id).first()
        if taken:
            raise HTTPException(status_code=409, detail="Name already taken")
        user.name = name

    user.jersey_number = payload.jersey_number
    user.jersey_color = payload.jersey_color

    db.commit()
    db.refresh(user)

    return user


@router.post("/{target_google_id}/follow")
def follow_user(
    target_google_id: str,
    follower_id: str = Query(...),
    db: Session = Depends(get_db),
):
    current = db.query(User).filter(User.google_id == follower_id).first()
    if not current:
        raise HTTPException(status_code=404, detail="User not found")

    target = db.query(User).filter(User.google_id == target_google_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")

    if current.id == target.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    existing = db.query(Follow).filter(
        Follow.follower_id == current.id, Follow.following_id == target.id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already following")

    db.add(Follow(follower_id=current.id, following_id=target.id))
    db.commit()
    return {"ok": True}


@router.delete("/{target_google_id}/follow")
def unfollow_user(
    target_google_id: str,
    follower_id: str = Query(...),
    db: Session = Depends(get_db),
):
    current = db.query(User).filter(User.google_id == follower_id).first()
    if not current:
        raise HTTPException(status_code=404, detail="User not found")

    target = db.query(User).filter(User.google_id == target_google_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")

    follow = db.query(Follow).filter(
        Follow.follower_id == current.id, Follow.following_id == target.id
    ).first()
    if not follow:
        raise HTTPException(status_code=404, detail="Not following")

    db.delete(follow)
    db.commit()
    return {"ok": True}


@router.get("/{target_google_id}/follow-stats", response_model=FollowStats)
def follow_stats(
    target_google_id: str,
    viewer_id: str = Query(None),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.google_id == target_google_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    follower_count = db.query(func.count(Follow.id)).filter(Follow.following_id == target.id).scalar()
    following_count = db.query(func.count(Follow.id)).filter(Follow.follower_id == target.id).scalar()

    is_following = False
    if viewer_id:
        viewer = db.query(User).filter(User.google_id == viewer_id).first()
        if viewer:
            is_following = db.query(Follow).filter(
                Follow.follower_id == viewer.id, Follow.following_id == target.id
            ).first() is not None

    return FollowStats(
        follower_count=follower_count,
        following_count=following_count,
        is_following=is_following,
    )


@router.get("/{target_google_id}/followers", response_model=list[FollowUserPublic])
def get_followers(target_google_id: str, db: Session = Depends(get_db)):
    target = db.query(User).filter(User.google_id == target_google_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    follower_ids = [f.follower_id for f in db.query(Follow).filter(Follow.following_id == target.id).all()]
    return db.query(User).filter(User.id.in_(follower_ids)).order_by(User.points.desc()).all()


@router.get("/{target_google_id}/following", response_model=list[FollowUserPublic])
def get_following(target_google_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.google_id == target_google_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    following_ids = [f.following_id for f in db.query(Follow).filter(Follow.follower_id == user.id).all()]
    return db.query(User).filter(User.id.in_(following_ids)).order_by(User.points.desc()).all()
