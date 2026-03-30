import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Enum, ForeignKey, UniqueConstraint, Float, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
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
    (2,  "Professional",  1.5),
    (0,  "Rookie",        1.0),
]
BASE_POINTS = 10
POST_TOSS_MULTIPLIER = 0.5


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
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    predictions = relationship("Prediction", back_populates="user")
    contest_entries = relationship("ContestEntry", back_populates="user")

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
    league = Column(String, nullable=False)         # IPL, ICC T20 WC, BBL, etc.
    season = Column(String, nullable=False)         # e.g. "2026"
    team1 = Column(String, nullable=False)
    team2 = Column(String, nullable=False)
    venue = Column(String, nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    toss_time = Column(DateTime(timezone=True), nullable=False)  # predictions locked after this
    status = Column(Enum(MatchStatus), default=MatchStatus.upcoming, nullable=False)
    winner = Column(String, nullable=True)

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
