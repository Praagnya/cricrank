"""
Append-only coin ledger + balance updates on users.coins.
All credits/debits go through here so fancy games stay auditable and idempotent.
"""

from __future__ import annotations

import uuid
from datetime import datetime, date
from zoneinfo import ZoneInfo

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models import CoinTransaction, User

IST = ZoneInfo("Asia/Kolkata")

# Daily login reward (IST calendar day, once per day per user)
DAILY_LOGIN_COINS = 100


def ist_calendar_date() -> date:
    return datetime.now(IST).date()


def apply_credit(
    db: Session,
    user_id: uuid.UUID,
    amount: int,
    kind: str,
    idempotency_key: str,
    ref_type: str | None = None,
    ref_id: str | None = None,
) -> int:
    """
    Add coins. Idempotent: duplicate idempotency_key returns 0 without changing balance.
    Returns amount credited (0 if duplicate / race lost).
    """
    if amount <= 0:
        raise ValueError("credit amount must be positive")

    if db.query(CoinTransaction).filter(CoinTransaction.idempotency_key == idempotency_key).first():
        return 0

    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    if not user:
        raise ValueError("user not found")

    try:
        with db.begin_nested():
            user.coins += amount
            row = CoinTransaction(
                user_id=user_id,
                delta=amount,
                balance_after=user.coins,
                kind=kind,
                idempotency_key=idempotency_key,
                ref_type=ref_type,
                ref_id=ref_id,
            )
            db.add(row)
            db.flush()
    except IntegrityError:
        return 0

    return amount


def apply_debit(
    db: Session,
    user_id: uuid.UUID,
    amount: int,
    kind: str,
    idempotency_key: str,
    ref_type: str | None = None,
    ref_id: str | None = None,
) -> int:
    """
    Deduct coins if balance allows. Idempotent: duplicate key returns 0.
    Returns amount debited (0 if duplicate / race lost).
    Raises ValueError("insufficient_coins") if balance too low on first attempt.
    """
    if amount <= 0:
        raise ValueError("debit amount must be positive")

    if db.query(CoinTransaction).filter(CoinTransaction.idempotency_key == idempotency_key).first():
        return 0

    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    if not user:
        raise ValueError("user not found")
    if user.coins < amount:
        raise ValueError("insufficient_coins")

    try:
        with db.begin_nested():
            user.coins -= amount
            row = CoinTransaction(
                user_id=user_id,
                delta=-amount,
                balance_after=user.coins,
                kind=kind,
                idempotency_key=idempotency_key,
                ref_type=ref_type,
                ref_id=ref_id,
            )
            db.add(row)
            db.flush()
    except IntegrityError:
        return 0

    return amount


def claim_daily_login(db: Session, user: User) -> int:
    """
    Award DAILY_LOGIN_COINS once per IST calendar day. Idempotent via ledger key.
    """
    day = ist_calendar_date().isoformat()
    key = f"daily_login:{user.id}:{day}"
    return apply_credit(
        db,
        user.id,
        DAILY_LOGIN_COINS,
        "daily_login",
        idempotency_key=key,
        ref_type="daily_login",
        ref_id=day,
    )
