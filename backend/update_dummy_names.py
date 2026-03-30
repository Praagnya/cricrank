from database import SessionLocal
from models import User

def run():
    db = SessionLocal()
    
    gamified_names = [
        "praagnya08",
        "xX_Sniper_Xx",
        "Hitman_45",
        "cric_master99",
        "KingKohli_Fan",
        "Thala_07",
        "yorker_king",
        "stump_breaker",
        "six_machine",
        "cricket_bot",
        "admin_god"
    ]
    
    # Fetch all dummy users created previously
    dummies = db.query(User).filter(User.email.like("%@dummy.com")).all()
    
    # Update their names
    count = 0
    for dummy, new_name in zip(dummies, gamified_names):
        dummy.name = new_name
        count += 1
        
    try:
        db.commit()
        print(f"Successfully updated {count} dummy names to full gamer-tags!")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run()
