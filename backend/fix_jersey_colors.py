"""
Fix jersey_color for users who have the old default '#ffffff'.
Sets them to NULL so CricketAvatar uses its hash-based team palette.
Also assigns jersey_number to users who don't have one.
"""
import random
from sqlalchemy import text
from database import SessionLocal
from models import User


def fix():
    db = SessionLocal()
    try:
        # 0. Make the column nullable in the DB (model already set nullable=True)
        db.execute(text("ALTER TABLE users ALTER COLUMN jersey_color DROP NOT NULL"))
        db.execute(text("ALTER TABLE users ALTER COLUMN jersey_color DROP DEFAULT"))
        db.commit()
        print("Altered jersey_color column: dropped NOT NULL and DEFAULT.")

        # 1. Clear the old default white — let hash-based palette take over
        result = db.execute(
            text("UPDATE users SET jersey_color = NULL WHERE jersey_color = '#ffffff'")
        )
        cleared = result.rowcount
        db.commit()
        print(f"Cleared jersey_color on {cleared} users (was '#ffffff').")

        # 2. Assign jersey numbers to anyone still missing one
        users_without_number = db.query(User).filter(User.jersey_number.is_(None)).all()
        for u in users_without_number:
            u.jersey_number = random.randint(1, 99)
        db.commit()
        print(f"Assigned jersey_number to {len(users_without_number)} users.")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    fix()
