"""
Match winner resolution from CricAPI payloads — conservative to avoid false settlements
(no-result / abandoned / tie lines must not invent a winner).
"""

from __future__ import annotations

import re

from team_metadata import canonicalize_team, normalize_text

# Substrings in `status` that mean there is no single match winner to score against.
# Keep multi-word phrases; avoid bare "tie" (e.g. "Twenty20").
_VOID_STATUS_SNIPPETS: tuple[str, ...] = (
    "no result",
    "without result",
    "match abandoned",
    "abandoned without",
    "play abandoned",
    "match called off",
    "washed out",
    "washout",
    "no play possible",
    "ended in a tie",
    "match tied",
    "scores are level",
    "match drawn",
    "match ends in a draw",
)


def status_indicates_void_or_no_result(status: str | None) -> bool:
    if not status or not str(status).strip():
        return False
    s = str(status).lower()
    return any(snippet in s for snippet in _VOID_STATUS_SNIPPETS)


_PREMATCH_SCHEDULE_MARKERS: tuple[str, ...] = (
    "match starts",
    "match yet to begin",
    "yet to begin",
)


def prematch_schedule_status_line(status: str | None) -> bool:
    """
    True when the CricAPI `status` line is a fixture schedule blurb, not a result.
    Those strings are sometimes left on the row after the match is marked completed.
    """
    if not status or not str(status).strip():
        return False
    s = str(status).lower()
    if any(m in s for m in _PREMATCH_SCHEDULE_MARKERS):
        return True
    if "starts at" in s and re.search(r"\b(gmt|utc|ist|local time)\b", s):
        return True
    return False


def normalize_completed_result_summary(
    status_line: str | None,
    winner: str | None,
    team1: str,
    team2: str,
) -> str | None:
    """
    Pick a sensible persisted/display line for a completed match.
    Prefer a real result string; never keep a pre-match schedule line when we have a side winner.
    """
    s = (status_line or "").strip()
    if status_indicates_void_or_no_result(s):
        return s if s else None
    if s and not prematch_schedule_status_line(s):
        return s
    if winner and winner in (team1, team2):
        return f"{winner} won"
    return None


def _flex_team_pattern(team: str) -> str:
    parts = [p for p in team.strip().split() if p]
    if not parts:
        return re.escape(team.strip())
    return r"\s+".join(re.escape(p) for p in parts)


def _winner_from_status_line(status: str, team1: str, team2: str) -> str | None:
    """Only when the line clearly names a winner (full name, short code, or Team A beat Team B)."""
    if not status:
        return None
    participants = {team1, team2}
    for t in sorted((team1, team2), key=len, reverse=True):
        pat = rf"(?i){_flex_team_pattern(t)}\s+won\b"
        if re.search(pat, status):
            return t
    # Feeds often use codes: "RCB won by 7 wickets" (full-name regex would miss).
    from team_metadata import LEGACY_TEAM_NAMES

    for alias, canonical in LEGACY_TEAM_NAMES.items():
        if canonical not in participants:
            continue
        if re.search(rf"(?i)\b{re.escape(alias)}\s+won\b", status):
            return canonical
    # e.g. "Royal Challengers Bengaluru beat Mumbai Indians by 7 wickets"
    for a in sorted((team1, team2), key=len, reverse=True):
        for b in (team1, team2):
            if a == b:
                continue
            if re.search(
                rf"(?i){_flex_team_pattern(a)}\s+beat\s+{_flex_team_pattern(b)}\b",
                status,
            ):
                return a
    return None


def _canonical_side(name: str | None, team1: str, team2: str) -> str | None:
    if not name:
        return None
    c = canonicalize_team(name.strip()) or name.strip()
    for t in (team1, team2):
        if c == t or normalize_text(c) == normalize_text(t):
            return t
    return None


def match_has_participant_winner(match) -> bool:
    """True only when winner is exactly one of the two sides (not null, not junk like \"No Winner\")."""
    w = match.winner
    if w is None or not str(w).strip():
        return False
    return w in (match.team1, match.team2)


def coerce_match_winner_in_place(match) -> bool:
    """
    If match.winner is set but is not exactly team1 or team2, clear it.
    Stops feeds like \"No Winner\" / \"Tie\" from triggering wrong-side settlement.
    Returns True if the row was modified.
    """
    w = match.winner
    if w is None or not str(w).strip():
        return False
    if w in (match.team1, match.team2):
        return False
    match.winner = None
    return True


def resolve_match_winner_from_cricapi(payload: dict, team1: str, team2: str) -> str | None:
    """
    Return canonical team1/team2 winner, or None if the fixture has no decisive result
    or the feed does not name a clear winner.
    """
    status = payload.get("status")
    if status_indicates_void_or_no_result(status):
        return None

    mw = payload.get("matchWinner")
    if mw:
        side = _canonical_side(str(mw), team1, team2)
        if side:
            return side

    if not payload.get("matchEnded"):
        return None

    st = status if isinstance(status, str) else ""
    return _winner_from_status_line(st, team1, team2)
