import uuid
import secrets
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Enum, ForeignKey, UniqueConstraint, Float, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

import enum


# ── Enums ────────────────────────────────────────────────────────────────────

class MatchStatus(str, enum.Enum):
    upcoming = "upcoming"
    live = "live"
    completed = "completed"


class ContestType(str, enum.Enum):
    weekly = "weekly"
    monthly = "monthly"
    tournament = "tournament"


# ── Streak config ─────────────────────────────────────────────────────────────
# Centralised here so it's easy to update without touching logic

STREAK_TIERS = [
    (14, "God Mode",     10.0),
    (7,  "Immortal",      5.0),
    (5,  "Legend",        3.0),
    (3,  "Veteran",       2.0),
    (2,  "Pro",  1.5),
    (0,  "Rookie",        1.0),
]
BASE_POINTS = 10
POST_TOSS_MULTIPLIER = 0.5

JERSEY_COLORS = [
    "#1e3a8a", "#fbbf24", "#7f1d1d", "#831843", "#3730a3",
    "#064e3b", "#991b1b", "#ea580c", "#0f172a", "#172554",
]


def get_streak_multiplier(streak: int) -> tuple[str, float]:
    """Return (tier_name, multiplier) for a given streak count."""
    for min_streak, name, multiplier in STREAK_TIERS:
        if streak >= min_streak:
            return name, multiplier
    return "Rookie", 1.0


def calculate_points(streak: int) -> int:
    _, multiplier = get_streak_multiplier(streak)
    return int(BASE_POINTS * multiplier)


# ── Models ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    google_id = Column(String, unique=True, nullable=False)
    username = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    avatar_url = Column(String, nullable=True)
    points = Column(Integer, default=0, nullable=False)
    total_predictions = Column(Integer, default=0, nullable=False)
    correct_predictions = Column(Integer, default=0, nullable=False)
    settled_predictions = Column(Integer, default=0, nullable=False)
    current_streak = Column(Integer, default=0, nullable=False)
    longest_streak = Column(Integer, default=0, nullable=False)
    jersey_number = Column(Integer, nullable=True)
    jersey_color = Column(String, nullable=True)
    coins = Column(Integer, default=1000, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    predictions = relationship("Prediction", back_populates="user")
    contest_entries = relationship("ContestEntry", back_populates="user")
    coin_transactions = relationship("CoinTransaction", back_populates="user")

    @property
    def accuracy(self) -> float:
        if self.settled_predictions == 0:
            return 0.0
        return round((self.correct_predictions / self.settled_predictions) * 100, 1)

    @property
    def streak_tier(self) -> str:
        name, _ = get_streak_multiplier(self.current_streak)
        return name


class Match(Base):
    __tablename__ = "matches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cricapi_id = Column(String, nullable=True, unique=True)
    series_id = Column(String, nullable=True)
    series_name = Column(String, nullable=True)
    league = Column(String, nullable=False)         # IPL, ICC T20 WC, BBL, etc.
    season = Column(String, nullable=False)         # e.g. "2026"
    team1 = Column(String, nullable=False)
    team2 = Column(String, nullable=False)
    venue = Column(String, nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    toss_time = Column(DateTime(timezone=True), nullable=False)  # predictions locked after this
    status = Column(Enum(MatchStatus), default=MatchStatus.upcoming, nullable=False)
    winner = Column(String, nullable=True)
    result_summary = Column(String, nullable=True)
    toss_winner = Column(String, nullable=True)  # canonical team name from feed when known

    predictions = relationship("Prediction", back_populates="match")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    match_id = Column(UUID(as_uuid=True), ForeignKey("matches.id"), nullable=False)
    selected_team = Column(String, nullable=False)
    is_correct = Column(Integer, nullable=True)     # NULL until match completes, 1=correct, 0=wrong
    is_post_toss = Column(Boolean, default=False, nullable=False)  # True if predicted after toss
    points_awarded = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="predictions")
    match = relationship("Match", back_populates="predictions")

    __table_args__ = (
        UniqueConstraint("user_id", "match_id", name="uq_user_match_prediction"),
    )


class Contest(Base):
    __tablename__ = "contests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)           # e.g. "IPL 2026 - Week 1"
    type = Column(Enum(ContestType), nullable=False)
    league = Column(String, nullable=False)
    season = Column(String, nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    entries = relationship("ContestEntry", back_populates="contest")


class Squad(Base):
    __tablename__ = "squads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    invite_code = Column(String(8), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    members = relationship("SquadMember", back_populates="squad", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[creator_id])


class SquadMember(Base):
    __tablename__ = "squad_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    squad_id = Column(UUID(as_uuid=True), ForeignKey("squads.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    squad = relationship("Squad", back_populates="members")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("squad_id", "user_id", name="uq_squad_member"),
    )


class Follow(Base):
    __tablename__ = "follows"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    follower_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    following_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    follower = relationship("User", foreign_keys=[follower_id])
    following = relationship("User", foreign_keys=[following_id])

    __table_args__ = (
        UniqueConstraint("follower_id", "following_id", name="uq_follow"),
    )


class TossPlay(Base):
    """Predict match toss winner; coins awarded when feed reports toss and pick matches."""

    __tablename__ = "toss_plays"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    match_id = Column(UUID(as_uuid=True), ForeignKey("matches.id"), nullable=False, index=True)
    picked_team = Column(String, nullable=False)
    stake = Column(Integer, nullable=False, default=100)
    winning_team = Column(String, nullable=True)  # set when match toss is known from feed
    coins_won = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "match_id", name="uq_toss_user_match"),)


class FirstInningsPick(Base):
    """Predict first innings runs total; exact match wins 10,000 coins. Up to 3 guesses (stakes: 10, 50, 100)."""

    __tablename__ = "first_innings_picks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    match_id = Column(UUID(as_uuid=True), ForeignKey("matches.id"), nullable=False, index=True)
    predicted_team = Column(String, nullable=False)
    predicted_score = Column(Integer, nullable=False)
    stake = Column(Integer, nullable=False, default=10)
    actual_team = Column(String, nullable=True)
    actual_score = Column(Integer, nullable=True)
    coins_won = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class CoinTransaction(Base):
    __tablename__ = "coin_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    delta = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    kind = Column(String(32), nullable=False)
    idempotency_key = Column(String(128), unique=True, nullable=False)
    ref_type = Column(String(32), nullable=True)
    ref_id = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="coin_transactions")


class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id = Column(UUID(as_uuid=True), ForeignKey("matches.id"), nullable=False)
    challenger_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    challenger_team = Column(String, nullable=False)
    challenger_stake = Column(Integer, nullable=False)
    challenger_wants = Column(Integer, nullable=False)

    acceptor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    invited_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    share_token = Column(String, unique=True, nullable=False, default=lambda: secrets.token_urlsafe(10))

    status = Column(String, nullable=False, default="open")
    # open | accepted | counter_offered | declined | expired | cancelled | settled

    counter_challenger_stake = Column(Integer, nullable=True)
    counter_challenger_wants = Column(Integer, nullable=True)

    winner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    settled_at = Column(DateTime(timezone=True), nullable=True)

    challenger = relationship("User", foreign_keys=[challenger_id])
    acceptor = relationship("User", foreign_keys=[acceptor_id])
    invited_user = relationship("User", foreign_keys=[invited_user_id])
    match = relationship("Match")


class ContestEntry(Base):
    __tablename__ = "contest_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    contest_id = Column(UUID(as_uuid=True), ForeignKey("contests.id"), nullable=False)
    points = Column(Integer, default=0, nullable=False)
    rank = Column(Integer, nullable=True)           # computed and cached at contest end

    user = relationship("User", back_populates="contest_entries")
    contest = relationship("Contest", back_populates="entries")

    __table_args__ = (
        UniqueConstraint("user_id", "contest_id", name="uq_user_contest"),
    )
