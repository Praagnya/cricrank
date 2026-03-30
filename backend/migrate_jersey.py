import random
from sqlalchemy import text
from database import SessionLocal
from models import User

def migrate():
    db = SessionLocal()
    try:
        # PostgreSQL syntax to add column harmlessly if it doesn't already exist
        # IF NOT EXISTS is standard for Postgres >= 9.6
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS jersey_number INTEGER;"))
        db.commit()
        
        # Fetch all users whose jersey_number is still null
        users = db.query(User).filter(User.jersey_number == None).all()
        for u in users:
            u.jersey_number = random.randint(1, 99)
        
        db.commit()
        print(f"Successfully migrated {len(users)} users by assigning them fresh jersey numbers.")
    except Exception as e:
        db.rollback()
        print(f"Error migrating database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
