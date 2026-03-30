import random
from sqlalchemy import text
from database import SessionLocal
from models import User

def seed():
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.jersey_number.is_(None)).all()
        for u in users:
            u.jersey_number = random.randint(1, 99)
            u.jersey_color = "#" + "".join([random.choice("0123456789ABCDEF") for _ in range(6)])
        db.commit()
        print(f"Assigned jersey numbers to {len(users)} users.")
    except Exception as e:
        db.rollback()
        print(e)
    finally:
        db.close()

if __name__ == "__main__":
    seed()
