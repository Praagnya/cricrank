from database import SessionLocal
from sqlalchemy import text
import sys

def migrate_teams():
    db = SessionLocal()
    updates = {
        "MI": "MUM", "KKR": "KOL", "RCB": "BLR", "CSK": "CHE",
        "DC": "DEL", "GT": "GUJ", "RR": "RAJ", "SRH": "HYD",
        "LSG": "LKN", "PBKS": "PUN"
    }
    
    try:
        for old, new in updates.items():
            db.execute(text("UPDATE matches SET team1 = :new WHERE team1 = :old"), {"new": new, "old": old})
            db.execute(text("UPDATE matches SET team2 = :new WHERE team2 = :old"), {"new": new, "old": old})
            db.execute(text("UPDATE matches SET winner = :new WHERE winner = :old"), {"new": new, "old": old})
            db.execute(text("UPDATE predictions SET selected_team = :new WHERE selected_team = :old"), {"new": new, "old": old})

        db.execute(text("UPDATE matches SET league = 'Indian T20 CUP'"))
        db.commit()
        print("Successfully migrated all database records to safe geographic codes!")
    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    migrate_teams()
