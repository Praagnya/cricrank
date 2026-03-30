import uuid
import random
from database import SessionLocal
from models import User

def seed_dummies():
    db = SessionLocal()
    
    # Check if dummies exist to avoid over-seeding on reruns
    existing = db.query(User).filter(User.email.like("%@dummy.com")).count()
    if existing > 0:
        print(f"Found {existing} dummy users already. Skipping seed.")
        return

    names = ["Kush", "Rahul", "Aarav", "Meera", "Vikram", "Neha", "Rohan", "Sanya", "Arjun", "Kavya", "Aryan"]
    
    users = []
    
    # 1. Manually create an absolute #1 leader with God Mode
    users.append(User(
        id=str(uuid.uuid4()),
        google_id="dummy_god",
        email="kush@dummy.com",
        name="Kush",
        points=1450,
        total_predictions=42,
        correct_predictions=38,
        current_streak=9,
        longest_streak=12,
    ))
    
    # 2. Add random other players to fill up lists
    for i, name in enumerate(names[1:]):
        total = random.randint(15, 40)
        correct = random.randint(5, total - 2)
        points = correct * 30 + random.randint(0, 50)
        streak = random.randint(0, 5)
        
        users.append(User(
            id=str(uuid.uuid4()),
            google_id=f"dummy_{i}",
            email=f"{name.lower()}@dummy.com",
            name=name,
            points=points,
            total_predictions=total,
            correct_predictions=correct,
            current_streak=streak,
            longest_streak=streak + random.randint(0, 3),
        ))
        
    try:
        db.add_all(users)
        db.commit()
        print(f"Successfully seeded {len(users)} dummy players to the leaderboard!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_dummies()
