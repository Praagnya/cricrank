"""
PredictXI AI Prediction Engine — v1

Current logic: strength-based with home ground advantage.
Designed to be extended with head-to-head, venue stats, and recent form later.
"""

from schemas import AIPredictionResponse

# ── Team Data ─────────────────────────────────────────────────────────────────
# Strength ratings out of 100. Update these each season.

TEAM_DATA: dict[str, dict] = {
    "MI":   {"strength": 85, "home_ground": "Wankhede Stadium, Mumbai",          "full_name": "Mumbai Indians"},
    "CSK":  {"strength": 87, "home_ground": "MA Chidambaram Stadium, Chennai",    "full_name": "Chennai Super Kings"},
    "RCB":  {"strength": 88, "home_ground": "M. Chinnaswamy Stadium, Bengaluru",  "full_name": "Royal Challengers Bengaluru"},
    "KKR":  {"strength": 84, "home_ground": "Eden Gardens, Kolkata",              "full_name": "Kolkata Knight Riders"},
    "SRH":  {"strength": 82, "home_ground": "Rajiv Gandhi Intl. Stadium, Hyderabad", "full_name": "Sunrisers Hyderabad"},
    "RR":   {"strength": 83, "home_ground": "Sawai Mansingh Stadium, Jaipur",     "full_name": "Rajasthan Royals"},
    "GT":   {"strength": 84, "home_ground": "Narendra Modi Stadium, Ahmedabad",   "full_name": "Gujarat Titans"},
    "PBKS": {"strength": 79, "home_ground": "PCA Stadium, Mohali",               "full_name": "Punjab Kings"},
    "LSG":  {"strength": 81, "home_ground": "BRSABV Ekana Stadium, Lucknow",      "full_name": "Lucknow Super Giants"},
    "DC":   {"strength": 80, "home_ground": "Arun Jaitley Stadium, Delhi",        "full_name": "Delhi Capitals"},
}

HOME_ADVANTAGE = 5  # bonus strength points for playing at home ground


# ── Engine ────────────────────────────────────────────────────────────────────

def predict(team1: str, team2: str, venue: str) -> AIPredictionResponse:
    """
    Returns a prediction for a match between team1 and team2 at a given venue.
    team1 and team2 should be short codes e.g. "MI", "KKR".
    """

    t1 = TEAM_DATA.get(team1.upper())
    t2 = TEAM_DATA.get(team2.upper())

    if not t1 or not t2:
        unknown = team1 if not t1 else team2
        raise ValueError(f"Unknown team: {unknown}. Add it to TEAM_DATA in engine.py.")

    t1_strength = t1["strength"]
    t2_strength = t2["strength"]

    # Home ground advantage
    t1_home = venue == t1["home_ground"]
    t2_home = venue == t2["home_ground"]

    if t1_home:
        t1_strength += HOME_ADVANTAGE
    if t2_home:
        t2_strength += HOME_ADVANTAGE

    total = t1_strength + t2_strength
    t1_prob = round((t1_strength / total) * 100, 1)
    t2_prob = round(100 - t1_prob, 1)

    predicted_winner = team1 if t1_prob >= t2_prob else team2
    winner_prob = t1_prob if predicted_winner == team1 else t2_prob
    loser_prob = t2_prob if predicted_winner == team1 else t1_prob

    insights = _generate_insights(
        team1, team2, t1, t2, venue, t1_home, t2_home, t1_prob, t2_prob
    )

    return AIPredictionResponse(
        predicted_winner=predicted_winner,
        win_probability=winner_prob,
        opponent_probability=loser_prob,
        insights=insights,
    )


def _generate_insights(
    team1: str,
    team2: str,
    t1: dict,
    t2: dict,
    venue: str,
    t1_home: bool,
    t2_home: bool,
    t1_prob: float,
    t2_prob: float,
) -> list[str]:
    insights: list[str] = []

    # Home ground insight
    if t1_home:
        insights.append(
            f"{t1['full_name']} are playing at their home ground — {venue} — giving them a significant crowd and conditions advantage."
        )
    elif t2_home:
        insights.append(
            f"{t2['full_name']} are playing at their home ground — {venue} — giving them a significant crowd and conditions advantage."
        )
    else:
        insights.append(f"This is a neutral venue ({venue}) — no home advantage for either side.")

    # Strength comparison insight
    stronger = team1 if t1["strength"] >= t2["strength"] else team2
    stronger_data = t1 if stronger == team1 else t2
    weaker_data = t2 if stronger == team1 else t1
    diff = abs(t1["strength"] - t2["strength"])

    if diff == 0:
        insights.append(f"{t1['full_name']} and {t2['full_name']} are evenly matched on paper — this one could go either way.")
    elif diff <= 3:
        insights.append(
            f"{stronger_data['full_name']} hold a slight edge in overall squad strength, but it's too close to call with confidence."
        )
    else:
        insights.append(
            f"{stronger_data['full_name']} are rated {diff} points stronger than {weaker_data['full_name']} this season."
        )

    # Probability insight
    favourite = team1 if t1_prob >= t2_prob else team2
    fav_full = t1["full_name"] if favourite == team1 else t2["full_name"]
    fav_prob = max(t1_prob, t2_prob)

    if fav_prob >= 60:
        insights.append(f"Our model gives {fav_full} a {fav_prob}% win probability — a clear favourite heading into this match.")
    else:
        insights.append(f"With {fav_prob}% probability, {fav_full} edge ahead — but this is a highly competitive contest.")

    return insights[:3]  # always return exactly 3 insights
