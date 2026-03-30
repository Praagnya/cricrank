from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import random
from database import get_db
from models import User, JERSEY_COLORS
from schemas import UserCreate, UserPublic, UserIdentityUpdate

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
