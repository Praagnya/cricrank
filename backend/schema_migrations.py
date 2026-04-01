from sqlalchemy import inspect, text


def ensure_toss_winner_schema(engine) -> None:
    """matches.toss_winner column; toss_plays.winning_team nullable for pending predictions."""
    inspector = inspect(engine)
    dialect = engine.dialect.name

    with engine.begin() as connection:
        if "matches" in inspector.get_table_names():
            cols = {c["name"] for c in inspector.get_columns("matches")}
            if "toss_winner" not in cols:
                connection.execute(text("ALTER TABLE matches ADD COLUMN toss_winner VARCHAR"))

        if "toss_plays" not in inspector.get_table_names():
            return

        for col in inspector.get_columns("toss_plays"):
            if col["name"] == "winning_team" and col.get("nullable") is False:
                if dialect == "postgresql":
                    connection.execute(text("ALTER TABLE toss_plays ALTER COLUMN winning_team DROP NOT NULL"))
                elif dialect == "sqlite":
                    try:
                        connection.execute(text("ALTER TABLE toss_plays ALTER COLUMN winning_team DROP NOT NULL"))
                    except Exception:
                        pass
                break


def ensure_first_innings_schema(engine) -> None:
    """Create first_innings_picks table if missing, or migrate existing table."""
    inspector = inspect(engine)
    if "first_innings_picks" not in inspector.get_table_names():
        with engine.begin() as connection:
            connection.execute(text("""
                CREATE TABLE first_innings_picks (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES users(id),
                    match_id UUID NOT NULL REFERENCES matches(id),
                    predicted_team VARCHAR NOT NULL,
                    predicted_score INTEGER NOT NULL,
                    stake INTEGER NOT NULL DEFAULT 10,
                    actual_team VARCHAR,
                    actual_score INTEGER,
                    coins_won INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """))
            connection.execute(text("CREATE INDEX ix_fip_user ON first_innings_picks (user_id)"))
            connection.execute(text("CREATE INDEX ix_fip_match ON first_innings_picks (match_id)"))
        return

    # Table already exists — apply migrations
    with engine.begin() as connection:
        # Drop unique constraint if still present (old single-entry schema)
        connection.execute(text(
            "ALTER TABLE first_innings_picks DROP CONSTRAINT IF EXISTS uq_first_innings_user_match"
        ))
        # Add stake column if missing
        cols = {c["name"] for c in inspector.get_columns("first_innings_picks")}
        if "stake" not in cols:
            connection.execute(text(
                "ALTER TABLE first_innings_picks ADD COLUMN stake INTEGER NOT NULL DEFAULT 10"
            ))


def ensure_match_schema_upgrades(engine) -> None:
    inspector = inspect(engine)
    if "matches" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("matches")}
    statements: list[str] = []

    if "cricapi_id" not in existing_columns:
        statements.append("ALTER TABLE matches ADD COLUMN cricapi_id VARCHAR")
    if "series_id" not in existing_columns:
        statements.append("ALTER TABLE matches ADD COLUMN series_id VARCHAR")
    if "series_name" not in existing_columns:
        statements.append("ALTER TABLE matches ADD COLUMN series_name VARCHAR")
    if "result_summary" not in existing_columns:
        statements.append("ALTER TABLE matches ADD COLUMN result_summary VARCHAR")

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        connection.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_matches_cricapi_id ON matches (cricapi_id)")
        )
