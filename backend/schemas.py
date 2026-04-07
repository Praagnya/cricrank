from pydantic import BaseModel, EmailStr, UUID4, Field, model_validator
from datetime import datetime
from typing import Optional
from models import MatchStatus, ContestType


# ── User ────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    google_id: str
    name: str
    email: EmailStr
    avatar_url: Optional[str] = None
    ref_code: Optional[str] = None

class UserIdentityUpdate(BaseModel):
    jersey_number: int
    jersey_color: str
    display_name: Optional[str] = None
    username: Optional[str] = None


class UserPublic(BaseModel):
    id: UUID4
    google_id: str
    username: str
    name: str
    email: EmailStr
    avatar_url: Optional[str] = None
    points: int
    total_predictions: int
    settled_predictions: int
    correct_predictions: int
    accuracy: float
    current_streak: int
    longest_streak: int
    streak_tier: str
    jersey_number: Optional[int] = None
    jersey_color: Optional[str] = None
    coins: int = 1000
    referral_code: Optional[str] = None

    model_config = {"from_attributes": True}


class UserLoginResponse(UserPublic):
    """POST /users/ — includes optional daily coin bonus for this login."""

    daily_login_coins_awarded: int = 0
    referral_coins_awarded: int = 0


class FirstInningsPickRequest(BaseModel):
    predicted_score: int


class FirstInningsPickItem(BaseModel):
    predicted_team: Optional[str] = None
    predicted_score: int
    stake: int
    actual_team: Optional[str] = None
    actual_score: Optional[int] = None
    coins_won: int = 0
    pending: bool = True
    settled: bool = False


class FirstInningsPickResponse(BaseModel):
    picks: list[FirstInningsPickItem]
    pick_count: int
    next_stake: Optional[int] = None   # None when capped at 3
    coins_balance: int


class FirstInningsStatusResponse(BaseModel):
    played: bool
    picks: list[FirstInningsPickItem] = []
    pick_count: int = 0
    next_stake: Optional[int] = None   # None when capped at 3 or locked


class TossPickRequest(BaseModel):
    picked_team: str
    stake: int = 100


class TossPickResponse(BaseModel):
    picked_team: str
    stake: int = 100
    winning_team: Optional[str] = None
    coins_won: int = 0
    coins_balance: int
    already_played: bool = False
    pending: bool = False
    settled: bool = False


class TossStatusResponse(BaseModel):
    played: bool
    picked_team: Optional[str] = None
    stake: int = 100
    winning_team: Optional[str] = None
    coins_won: int = 0
    pending: bool = False
    settled: bool = False


class LeaderboardEntry(BaseModel):
    google_id: str
    username: str
    rank: int
    name: str
    avatar_url: Optional[str] = None
    points: int
    accuracy: float
    total_predictions: int
    settled_predictions: int
    correct_predictions: int
    current_streak: int
    streak_tier: str
    jersey_number: Optional[int] = None
    jersey_color: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Match ────────────────────────────────────────────────────────────────────

class MatchCreate(BaseModel):
    cricapi_id: Optional[str] = None
    series_id: Optional[str] = None
    series_name: Optional[str] = None
    league: str
    season: str
    team1: str
    team2: str
    venue: str
    start_time: datetime
    toss_time: datetime


class MatchPublic(BaseModel):
    id: UUID4
    cricapi_id: Optional[str] = None
    series_id: Optional[str] = None
    series_name: Optional[str] = None
    league: str
    season: str
    team1: str
    team2: str
    venue: str
    start_time: datetime
    toss_time: datetime
    status: MatchStatus
    winner: Optional[str] = None
    result_summary: Optional[str] = None
    toss_winner: Optional[str] = None

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def default_result_summary_when_missing(self):
        """Feed often omits status text; we still have winner after settlement."""
        if (
            self.status == MatchStatus.completed
            and self.winner
            and not (self.result_summary and self.result_summary.strip())
        ):
            return self.model_copy(update={"result_summary": f"{self.winner} won"})
        return self


class SeriesSyncRequest(BaseModel):
    series_id: str
    league: str
    season: str
    series_name: Optional[str] = None


class SeriesSyncResponse(BaseModel):
    series_id: str
    series_name: str
    created: int
    updated: int
    matched_existing: int
    predictions_updated: int
    winners_updated: int
    total_matches: int


class MatchLiveResponse(BaseModel):
    match_id: UUID4
    cricapi_id: str
    status: MatchStatus
    match_started: bool
    match_ended: bool
    status_text: Optional[str] = None
    match_winner: Optional[str] = None
    result_summary: Optional[str] = None
    score: list[dict] = Field(default_factory=list)
    bbb: list[dict] = Field(default_factory=list)


class MatchScorecardResponse(BaseModel):
    match_id: UUID4
    cricapi_id: str
    score: list[dict] = Field(default_factory=list)
    scorecard: list[dict] = Field(default_factory=list)


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
    settled_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PredictionWithMatch(PredictionPublic):
    match: MatchPublic

    model_config = {"from_attributes": True}


# ── Squad ────────────────────────────────────────────────────────────────────

class SquadPublic(BaseModel):
    id: UUID4
    name: str
    invite_code: str
    member_count: int
    is_creator: bool = False

    model_config = {"from_attributes": True}


class SquadCreate(BaseModel):
    name: str
    google_id: str


# ── Follow ───────────────────────────────────────────────────────────────────

class FollowStats(BaseModel):
    follower_count: int
    following_count: int
    is_following: bool


class FollowUserPublic(BaseModel):
    google_id: str
    username: str
    name: str
    avatar_url: Optional[str] = None
    jersey_number: Optional[int] = None
    jersey_color: Optional[str] = None
    streak_tier: str
    current_streak: int
    points: int

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


# ── Challenge ────────────────────────────────────────────────────────────────

class ChallengeCreate(BaseModel):
    match_id: UUID4
    challenger_team: str
    challenger_stake: int
    challenger_wants: int
    invited_google_id: Optional[str] = None


class ChallengeUserPublic(BaseModel):
    google_id: str
    username: str
    name: str
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class ChallengePublic(BaseModel):
    id: UUID4
    match_id: UUID4
    share_token: str
    status: str
    challenger_team: str
    challenger_stake: int
    challenger_wants: int
    acceptor_stake: int          # derived: challenger_wants - challenger_stake
    challenger: ChallengeUserPublic
    acceptor: Optional[ChallengeUserPublic] = None
    invited_user: Optional[ChallengeUserPublic] = None
    match: MatchPublic
    counter_challenger_stake: Optional[int] = None
    counter_challenger_wants: Optional[int] = None
    created_at: Optional[datetime] = None
    expires_at: datetime

    model_config = {"from_attributes": True}


class ChallengeCounterRequest(BaseModel):
    challenger_stake: int
    challenger_wants: int


class ChallengeListResponse(BaseModel):
    challenges: list[ChallengePublic]
    pending_count: int   # challenges waiting on the user to act (not created by them)


# ── AI Engine ────────────────────────────────────────────────────────────────

class AIPredictionResponse(BaseModel):
    predicted_winner: str
    win_probability: float
    opponent_probability: float
    insights: list[str]
