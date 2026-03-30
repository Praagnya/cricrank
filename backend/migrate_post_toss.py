"""
Migration: Add is_post_toss column to predictions table.
Run once: python migrate_post_toss.py
"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    conn.execute(text("""
        ALTER TABLE predictions
        ADD COLUMN IF NOT EXISTS is_post_toss BOOLEAN NOT NULL DEFAULT FALSE
    """))
    conn.commit()
    print("✅ Added is_post_toss column to predictions table")
