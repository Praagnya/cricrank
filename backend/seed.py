"""
Seed IPL 2026 full schedule (70 league matches) into Supabase.
Run once: python seed.py
"""

from datetime import datetime, timezone, timedelta
from database import engine, SessionLocal
from models import Base, Match, MatchStatus

# IST = UTC+5:30
IST = timezone(timedelta(hours=5, minutes=30))

def ist(year, month, day, hour, minute) -> datetime:
    """Return a timezone-aware datetime in IST, stored as UTC."""
    return datetime(year, month, day, hour, minute, tzinfo=IST)

def toss(start: datetime) -> datetime:
    """Toss is 30 minutes before start."""
    return start - timedelta(minutes=30)


# ── Venue mapping ─────────────────────────────────────────────────────────────

VENUES = {
    "Bengaluru":       "M. Chinnaswamy Stadium, Bengaluru",
    "Mumbai":          "Wankhede Stadium, Mumbai",
    "Guwahati":        "Barsapara Cricket Stadium, Guwahati",
    "New Chandigarh":  "Maharaja Yadavindra Singh Stadium, New Chandigarh",
    "Lucknow":         "BRSABV Ekana Stadium, Lucknow",
    "Kolkata":         "Eden Gardens, Kolkata",
    "Chennai":         "MA Chidambaram Stadium, Chennai",
    "Delhi":           "Arun Jaitley Stadium, Delhi",
    "Ahmedabad":       "Narendra Modi Stadium, Ahmedabad",
    "Hyderabad":       "Rajiv Gandhi International Stadium, Hyderabad",
    "Jaipur":          "Sawai Mansingh Stadium, Jaipur",
    "Raipur":          "Shaheed Veer Narayan Singh International Stadium, Raipur",
    "Dharamshala":     "HPCA Stadium, Dharamshala",
    "TBA":             "TBA",
}

# ── Match data ────────────────────────────────────────────────────────────────
# Format: (team1, team2, city, hour, minute)

MATCHES = [
    # Phase 1: Mar 28 – Apr 12
    ("BLR",  "HYD",  "Bengaluru",      2026, 3,  28, 19, 30),
    ("MUM",  "KOL",  "Mumbai",         2026, 3,  29, 19, 30),
    ("RAJ",  "CHE",  "Guwahati",       2026, 3,  30, 19, 30),
    ("PUN",  "GUJ",  "New Chandigarh", 2026, 3,  31, 19, 30),
    ("LKN",  "DEL",  "Lucknow",        2026, 4,   1, 19, 30),
    ("KOL",  "HYD",  "Kolkata",        2026, 4,   2, 19, 30),
    ("CHE",  "PUN",  "Chennai",        2026, 4,   3, 19, 30),
    ("DEL",  "MUM",  "Delhi",          2026, 4,   4, 15, 30),
    ("GUJ",  "RAJ",  "Ahmedabad",      2026, 4,   4, 19, 30),
    ("HYD",  "LKN",  "Hyderabad",      2026, 4,   5, 15, 30),
    ("BLR",  "CHE",  "Bengaluru",      2026, 4,   5, 19, 30),
    ("KOL",  "PUN",  "Kolkata",        2026, 4,   6, 19, 30),
    ("RAJ",  "MUM",  "Guwahati",       2026, 4,   7, 19, 30),
    ("DEL",  "GUJ",  "Delhi",          2026, 4,   8, 19, 30),
    ("KOL",  "LKN",  "Kolkata",        2026, 4,   9, 19, 30),
    ("RAJ",  "BLR",  "Guwahati",       2026, 4,  10, 19, 30),
    ("PUN",  "HYD",  "New Chandigarh", 2026, 4,  11, 15, 30),
    ("CHE",  "DEL",  "Chennai",        2026, 4,  11, 19, 30),
    ("LKN",  "GUJ",  "Lucknow",        2026, 4,  12, 15, 30),
    ("MUM",  "BLR",  "Mumbai",         2026, 4,  12, 19, 30),
    # Phase 2: Apr 13 – May 24
    ("HYD",  "RAJ",  "Hyderabad",      2026, 4,  13, 19, 30),
    ("CHE",  "KOL",  "Chennai",        2026, 4,  14, 19, 30),
    ("BLR",  "LKN",  "Bengaluru",      2026, 4,  15, 19, 30),
    ("MUM",  "PUN",  "Mumbai",         2026, 4,  16, 19, 30),
    ("GUJ",  "KOL",  "Ahmedabad",      2026, 4,  17, 19, 30),
    ("BLR",  "DEL",  "Bengaluru",      2026, 4,  18, 15, 30),
    ("HYD",  "CHE",  "Hyderabad",      2026, 4,  18, 19, 30),
    ("KOL",  "RAJ",  "Kolkata",        2026, 4,  19, 15, 30),
    ("PUN",  "LKN",  "New Chandigarh", 2026, 4,  19, 19, 30),
    ("GUJ",  "MUM",  "Ahmedabad",      2026, 4,  20, 19, 30),
    ("HYD",  "DEL",  "Hyderabad",      2026, 4,  21, 19, 30),
    ("LKN",  "RAJ",  "Lucknow",        2026, 4,  22, 19, 30),
    ("MUM",  "CHE",  "Mumbai",         2026, 4,  23, 19, 30),
    ("BLR",  "GUJ",  "Bengaluru",      2026, 4,  24, 19, 30),
    ("DEL",  "PUN",  "Delhi",          2026, 4,  25, 15, 30),
    ("RAJ",  "HYD",  "Jaipur",         2026, 4,  25, 19, 30),
    ("GUJ",  "CHE",  "Ahmedabad",      2026, 4,  26, 15, 30),
    ("LKN",  "KOL",  "Lucknow",        2026, 4,  26, 19, 30),
    ("DEL",  "BLR",  "Delhi",          2026, 4,  27, 19, 30),
    ("PUN",  "RAJ",  "New Chandigarh", 2026, 4,  28, 19, 30),
    ("MUM",  "HYD",  "Mumbai",         2026, 4,  29, 19, 30),
    ("GUJ",  "BLR",  "Ahmedabad",      2026, 4,  30, 19, 30),
    ("RAJ",  "DEL",  "Jaipur",         2026, 5,   1, 19, 30),
    ("CHE",  "MUM",  "Chennai",        2026, 5,   2, 19, 30),
    ("HYD",  "KOL",  "Hyderabad",      2026, 5,   3, 15, 30),
    ("GUJ",  "PUN",  "Ahmedabad",      2026, 5,   3, 19, 30),
    ("MUM",  "LKN",  "Mumbai",         2026, 5,   4, 19, 30),
    ("DEL",  "CHE",  "Delhi",          2026, 5,   5, 19, 30),
    ("HYD",  "PUN",  "Hyderabad",      2026, 5,   6, 19, 30),
    ("LKN",  "BLR",  "Lucknow",        2026, 5,   7, 19, 30),
    ("DEL",  "KOL",  "Delhi",          2026, 5,   8, 19, 30),
    ("RAJ",  "GUJ",  "Jaipur",         2026, 5,   9, 19, 30),
    ("CHE",  "LKN",  "Chennai",        2026, 5,  10, 15, 30),
    ("BLR",  "MUM",  "Raipur",         2026, 5,  10, 19, 30),
    ("PUN",  "DEL",  "TBA",            2026, 5,  11, 19, 30),
    ("GUJ",  "HYD",  "Ahmedabad",      2026, 5,  12, 19, 30),
    ("BLR",  "KOL",  "Raipur",         2026, 5,  13, 19, 30),
    ("PUN",  "MUM",  "Dharamshala",    2026, 5,  14, 19, 30),
    ("LKN",  "CHE",  "Lucknow",        2026, 5,  15, 19, 30),
    ("KOL",  "GUJ",  "Kolkata",        2026, 5,  16, 19, 30),
    ("PUN",  "BLR",  "Dharamshala",    2026, 5,  17, 15, 30),
    ("DEL",  "RAJ",  "Delhi",          2026, 5,  17, 19, 30),
    ("CHE",  "HYD",  "Chennai",        2026, 5,  18, 19, 30),
    ("RAJ",  "LKN",  "Jaipur",         2026, 5,  19, 19, 30),
    ("KOL",  "MUM",  "Kolkata",        2026, 5,  20, 19, 30),
    ("CHE",  "GUJ",  "Chennai",        2026, 5,  21, 19, 30),
    ("HYD",  "BLR",  "Hyderabad",      2026, 5,  22, 19, 30),
    ("LKN",  "PUN",  "Lucknow",        2026, 5,  23, 19, 30),
    ("MUM",  "RAJ",  "Mumbai",         2026, 5,  24, 15, 30),
    ("KOL",  "DEL",  "Kolkata",        2026, 5,  24, 19, 30),
]

def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        existing = db.query(Match).filter(Match.league == "Indian T20 CUP", Match.season == "2026").count()
        if existing > 0:
            print(f"{existing} Indian T20 CUP 2026 matches already exist. Skipping seed.")
            return

        matches = []
        for team1, team2, city, year, month, day, hour, minute in MATCHES:
            start = ist(year, month, day, hour, minute)
            matches.append(Match(
                league="Indian T20 CUP",
                season="2026",
                team1=team1,
                team2=team2,
                venue=VENUES[city],
                start_time=start,
                toss_time=toss(start),
                status=MatchStatus.upcoming,
                winner=None,
            ))

        db.add_all(matches)
        db.commit()
        print(f"Seeded {len(matches)} IPL 2026 matches successfully.")

    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
