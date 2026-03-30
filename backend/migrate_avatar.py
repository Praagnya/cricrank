import random
from sqlalchemy import text
from database import SessionLocal
from models import User

def migrate():
    db = SessionLocal()
    try:
        # Add column if it doesn't already exist
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR;"))
        db.commit()
        print(f"Successfully added avatar_url column.")
    except Exception as e:
        db.rollback()
        print(f"Error migrating database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
