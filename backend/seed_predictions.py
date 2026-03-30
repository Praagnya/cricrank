"""
Seed historical predictions for dummy users so Weekly & Monthly leaderboards 
have data. Run once: python seed_predictions.py
"""

import uuid
import random
from datetime import datetime, timezone, timedelta
from database import SessionLocal
from models import User, Match, Prediction

def seed_predictions():
    db = SessionLocal()

    # Only skip if we already have a large number (meaning a previous full seed ran)
    existing = db.query(Prediction).count()
    if existing > 50:
        print(f"Found {existing} predictions already. Skipping seed.")
        return

    users = db.query(User).filter(User.total_predictions > 0).all()
    matches = db.query(Match).all()

    if not users:
        print("No users found. Run seed_dummy_leaderboard.py first.")
        return
    if not matches:
        print("No matches found. Run seed.py first.")
        return

    print(f"Found {len(users)} users and {len(matches)} matches.")

    now = datetime.now(timezone.utc)
    predictions = []

    # Track existing (user_id, match_id) pairs to respect unique constraint
    existing_pairs = set()
    existing_preds = db.query(Prediction.user_id, Prediction.match_id).all()
    for uid, mid in existing_preds:
        existing_pairs.add((str(uid), str(mid)))

    for user in users:
        # Generate predictions spread across the last 45 days
        num_predictions = random.randint(8, 25)
        sampled_matches = random.sample(matches, min(num_predictions, len(matches)))

        for match in sampled_matches:
            pair_key = (str(user.id), str(match.id))
            if pair_key in existing_pairs:
                continue
            existing_pairs.add(pair_key)

            # Random date within last 45 days
            days_ago = random.randint(0, 45)
            created = now - timedelta(days=days_ago, hours=random.randint(0, 12))

            # Randomly pick a team and whether correct
            selected = random.choice([match.team1, match.team2])
            is_correct = random.choice([0, 0, 1, 1, 1])  # ~60% correct
            points = random.choice([10, 15, 20, 30]) if is_correct else 0

            predictions.append(Prediction(
                id=str(uuid.uuid4()),
                user_id=user.id,
                match_id=match.id,
                selected_team=selected,
                is_correct=is_correct,
                points_awarded=points,
                created_at=created,
            ))

    try:
        db.add_all(predictions)
        db.commit()

        # Count distribution
        week_count = sum(1 for p in predictions if (now - p.created_at).days <= 7)
        month_count = sum(1 for p in predictions if (now - p.created_at).days <= 30)
        print(f"Seeded {len(predictions)} predictions!")
        print(f"  Within last 7 days (weekly):  {week_count}")
        print(f"  Within last 30 days (monthly): {month_count}")
        print(f"  All time (45 days):            {len(predictions)}")

    except Exception as e:
        db.rollback()
        print(f"Error seeding predictions: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_predictions()
