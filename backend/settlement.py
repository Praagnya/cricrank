"""
Auto and manual match settlement: winner + prediction points + streaks.
"""

from sqlalchemy.orm import Session

from models import Match, MatchStatus, Prediction, User, calculate_points, POST_TOSS_MULTIPLIER
from team_metadata import canonicalize_winner


def apply_match_settlement(
    db: Session,
    match: Match,
    winner: str,
    result_summary: str | None = None,
) -> int:
    """
    Mark match completed, award points for predictions. Caller must db.commit().
    Raises ValueError if match already completed or winner invalid.
    """
    if match.status == MatchStatus.completed:
        raise ValueError("Match already settled")
    if winner not in (match.team1, match.team2):
        raise ValueError("winner must be one of the two teams")

    match.winner = winner
    match.status = MatchStatus.completed
    if result_summary:
        match.result_summary = result_summary

    predictions = db.query(Prediction).filter(Prediction.match_id == match.id).all()

    for pred in predictions:
        user = db.query(User).filter(User.id == pred.user_id).first()
        if not user:
            continue

        user.settled_predictions += 1
        if pred.selected_team == winner:
            pred.is_correct = 1
            user.current_streak += 1
            user.correct_predictions += 1
            if user.current_streak > user.longest_streak:
                user.longest_streak = user.current_streak
            pts = calculate_points(user.current_streak)
            if pred.is_post_toss:
                pts = int(pts * POST_TOSS_MULTIPLIER)
            pred.points_awarded = pts
            user.points += pts
        else:
            pred.is_correct = 0
            user.current_streak = 0
            pred.points_awarded = 0

    return len(predictions)


def try_settle_from_cricapi_payload(db: Session, match: Match, payload: dict) -> bool:
    """
    If CricAPI says the match ended and gives a winner we can map to team1/team2,
    run settlement. Returns True if settlement ran.
    """
    if match.status == MatchStatus.completed:
        return False
    if not payload.get("matchEnded"):
        return False

    w = canonicalize_winner(payload.get("matchWinner"))
    if not w or w not in (match.team1, match.team2):
        return False

    summary = payload.get("status") or None
    apply_match_settlement(db, match, w, summary)
    return True


def sync_match_status_from_payload(match: Match, payload: dict) -> bool:
    """
    Advance upcoming -> live from CricAPI. Never sets completed here (only via settlement).
    """
    changed = False
    if payload.get("matchEnded"):
        return False
    if payload.get("matchStarted") and match.status == MatchStatus.upcoming:
        match.status = MatchStatus.live
        changed = True
    if payload.get("status") and not match.result_summary:
        match.result_summary = payload["status"]
        changed = True
    return changed
