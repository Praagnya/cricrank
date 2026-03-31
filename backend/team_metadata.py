import re

LEGACY_TEAM_NAMES: dict[str, str] = {
    "MUM": "Mumbai Indians",
    "MI": "Mumbai Indians",
    "CHE": "Chennai Super Kings",
    "CSK": "Chennai Super Kings",
    "BLR": "Royal Challengers Bengaluru",
    "RCB": "Royal Challengers Bengaluru",
    "KOL": "Kolkata Knight Riders",
    "KKR": "Kolkata Knight Riders",
    "HYD": "Sunrisers Hyderabad",
    "SRH": "Sunrisers Hyderabad",
    "RAJ": "Rajasthan Royals",
    "RR": "Rajasthan Royals",
    "GUJ": "Gujarat Titans",
    "GT": "Gujarat Titans",
    "PUN": "Punjab Kings",
    "PBKS": "Punjab Kings",
    "LKN": "Lucknow Super Giants",
    "LSG": "Lucknow Super Giants",
    "DEL": "Delhi Capitals",
    "DC": "Delhi Capitals",
}

TEAM_METADATA: dict[str, dict[str, str]] = {
    "Mumbai Indians": {
        "short_code": "MI",
        "home_ground": "Wankhede Stadium, Mumbai",
    },
    "Chennai Super Kings": {
        "short_code": "CSK",
        "home_ground": "MA Chidambaram Stadium, Chennai",
    },
    "Royal Challengers Bengaluru": {
        "short_code": "RCB",
        "home_ground": "M.Chinnaswamy Stadium, Bengaluru",
    },
    "Kolkata Knight Riders": {
        "short_code": "KKR",
        "home_ground": "Eden Gardens, Kolkata",
    },
    "Sunrisers Hyderabad": {
        "short_code": "SRH",
        "home_ground": "Rajiv Gandhi International Stadium, Hyderabad",
    },
    "Rajasthan Royals": {
        "short_code": "RR",
        "home_ground": "Sawai Mansingh Stadium, Jaipur",
    },
    "Gujarat Titans": {
        "short_code": "GT",
        "home_ground": "Narendra Modi Stadium, Ahmedabad",
    },
    "Punjab Kings": {
        "short_code": "PBKS",
        "home_ground": "Himachal Pradesh Cricket Association Stadium, Dharamsala",
    },
    "Lucknow Super Giants": {
        "short_code": "LSG",
        "home_ground": "Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow",
    },
    "Delhi Capitals": {
        "short_code": "DC",
        "home_ground": "Arun Jaitley Stadium, Delhi",
    },
}

IPL_SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f"


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def canonicalize_team(team: str | None) -> str | None:
    if team is None:
        return None
    stripped = team.strip()
    return LEGACY_TEAM_NAMES.get(stripped.upper(), stripped)


def canonicalize_winner(team: str | None) -> str | None:
    return canonicalize_team(team)


def team_short_code(team: str) -> str:
    canonical = canonicalize_team(team) or team
    metadata = TEAM_METADATA.get(canonical)
    if metadata:
        return metadata["short_code"]
    words = [word[0] for word in canonical.split() if word]
    return "".join(words[:4]).upper() or canonical[:4].upper()


def normalize_team_pair(team1: str, team2: str) -> tuple[str, str]:
    return tuple(sorted((normalize_text(canonicalize_team(team1)), normalize_text(canonicalize_team(team2)))))


def league_aliases(league: str) -> set[str]:
    normalized = normalize_text(league)
    if normalized in {"ipl", "indiant20cup", "indianpremierleague", "indianpremierleague2026"}:
        return {"IPL", "Indian T20 CUP", "Indian Premier League", "Indian Premier League 2026"}
    return {league}
