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


def _flex_team_pattern(team: str) -> str:
    parts = [p for p in team.strip().split() if p]
    if not parts:
        return re.escape(team.strip())
    return r"\s+".join(re.escape(p) for p in parts)


def _winner_from_status_line(status: str, team1: str, team2: str) -> str | None:
    """Only when the line clearly says a full team name won (avoids toss / DRS noise)."""
    if not status:
        return None
    for t in sorted((team1, team2), key=len, reverse=True):
        pat = rf"(?i){_flex_team_pattern(t)}\s+won\b"
        if re.search(pat, status):
            return t
    return None


def _canonical_side(name: str | None, team1: str, team2: str) -> str | None:
    if not name:
        return None
    c = canonicalize_team(name.strip()) or name.strip()
    for t in (team1, team2):
        if c == t or normalize_text(c) == normalize_text(t):
            return t
    return None


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
