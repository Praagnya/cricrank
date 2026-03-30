from pydantic import BaseModel, EmailStr, UUID4
from datetime import datetime
from typing import Optional
from models import MatchStatus, ContestType


# ── User ────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    google_id: str
    name: str
    email: EmailStr
    avatar_url: Optional[str] = None

class UserIdentityUpdate(BaseModel):
    jersey_number: int
    jersey_color: str
    display_name: Optional[str] = None


class UserPublic(BaseModel):
    id: UUID4
    name: str
    email: EmailStr
    avatar_url: Optional[str] = None
    points: int
    total_predictions: int
    correct_predictions: int
    accuracy: float
    current_streak: int
    longest_streak: int
    streak_tier: str
    jersey_number: Optional[int] = None
    jersey_color: Optional[str] = None

    model_config = {"from_attributes": True}


class LeaderboardEntry(BaseModel):
    google_id: str
    rank: int
    name: str
    avatar_url: Optional[str] = None
    points: int
    accuracy: float
    total_predictions: int
    correct_predictions: int
    current_streak: int
    streak_tier: str
    jersey_number: Optional[int] = None
    jersey_color: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Match ────────────────────────────────────────────────────────────────────

class MatchCreate(BaseModel):
    league: str
    season: str
    team1: str
    team2: str
    venue: str
    start_time: datetime
    toss_time: datetime


class MatchPublic(BaseModel):
    id: UUID4
    league: str
    season: str
    team1: str
    team2: str
    venue: str
    start_time: datetime
    toss_time: datetime
    status: MatchStatus
    winner: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Prediction ───────────────────────────────────────────────────────────────

class PredictionCreate(BaseModel):
    match_id: UUID4
    selected_team: str


class PredictionPublic(BaseModel):
    id: UUID4
    match_id: UUID4
    selected_team: str
    is_correct: Optional[int] = None
    is_post_toss: bool = False
    points_awarded: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PredictionWithMatch(PredictionPublic):
    match: MatchPublic

    model_config = {"from_attributes": True}


# ── Contest ──────────────────────────────────────────────────────────────────

class ContestCreate(BaseModel):
    name: str
    type: ContestType
    league: str
    season: str
    start_date: datetime
    end_date: datetime


class ContestPublic(BaseModel):
    id: UUID4
    name: str
    type: ContestType
    league: str
    season: str
    start_date: datetime
    end_date: datetime

    model_config = {"from_attributes": True}


class ContestLeaderboardEntry(BaseModel):
    rank: int
    name: str
    points: int
    accuracy: float

    model_config = {"from_attributes": True}


# ── AI Engine ────────────────────────────────────────────────────────────────

class AIPredictionResponse(BaseModel):
    predicted_winner: str
    win_probability: float
    opponent_probability: float
    insights: list[str]
