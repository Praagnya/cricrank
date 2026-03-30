from sqlalchemy import text
from database import SessionLocal

def migrate():
    db = SessionLocal()
    try:
        # Add column if it doesn't already exist with a default white
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS jersey_color VARCHAR DEFAULT '#ffffff' NOT NULL;"))
        db.commit()
        print(f"Successfully added jersey_color column.")
    except Exception as e:
        db.rollback()
        print(f"Error migrating database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
