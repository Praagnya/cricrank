from sqlalchemy import inspect, text


def ensure_referral_schema(engine) -> None:
    """Add referral_code and referred_by_id to users table."""
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("users")}
    with engine.begin() as connection:
        if "referral_code" not in cols:
            connection.execute(text("ALTER TABLE users ADD COLUMN referral_code VARCHAR UNIQUE"))
            # Backfill existing users with a deterministic 8-char code from their UUID
            connection.execute(text(
                "UPDATE users SET referral_code = UPPER(SUBSTRING(MD5(id::text), 1, 8)) "
                "WHERE referral_code IS NULL"
            ))
        if "referred_by_id" not in cols:
            connection.execute(text(
                "ALTER TABLE users ADD COLUMN referred_by_id UUID REFERENCES users(id)"
            ))


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

    # Table already exists — check columns before opening transaction to avoid lock contention
    cols = {c["name"] for c in inspector.get_columns("first_innings_picks")}
    needs_nullable_team = any(
        c["name"] == "predicted_team" and not c.get("nullable", True)
        for c in inspector.get_columns("first_innings_picks")
    )
    needs_stake = "stake" not in cols

    with engine.begin() as connection:
        # Drop unique constraint if still present (old single-entry schema)
        connection.execute(text(
            "ALTER TABLE first_innings_picks DROP CONSTRAINT IF EXISTS uq_first_innings_user_match"
        ))
        if needs_stake:
            connection.execute(text(
                "ALTER TABLE first_innings_picks ADD COLUMN stake INTEGER NOT NULL DEFAULT 10"
            ))
        if needs_nullable_team:
            connection.execute(text(
                "ALTER TABLE first_innings_picks ALTER COLUMN predicted_team DROP NOT NULL"
            ))


def ensure_challenge_schema(engine) -> None:
    """Create challenges table if not exists, add invited_user_id column if missing."""
    inspector = inspect(engine)
    if "challenges" not in inspector.get_table_names():
        with engine.begin() as connection:
            connection.execute(text("""
                CREATE TABLE challenges (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    match_id UUID NOT NULL REFERENCES matches(id),
                    challenger_id UUID NOT NULL REFERENCES users(id),
                    challenger_team VARCHAR NOT NULL,
                    challenger_stake INTEGER NOT NULL,
                    challenger_wants INTEGER NOT NULL,
                    acceptor_id UUID REFERENCES users(id),
                    invited_user_id UUID REFERENCES users(id),
                    share_token VARCHAR NOT NULL UNIQUE,
                    status VARCHAR NOT NULL DEFAULT 'open',
                    counter_challenger_stake INTEGER,
                    counter_challenger_wants INTEGER,
                    winner_id UUID REFERENCES users(id),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    expires_at TIMESTAMPTZ NOT NULL,
                    settled_at TIMESTAMPTZ
                )
            """))
            connection.execute(text("CREATE INDEX ix_challenges_challenger ON challenges (challenger_id)"))
            connection.execute(text("CREATE INDEX ix_challenges_acceptor ON challenges (acceptor_id)"))
            connection.execute(text("CREATE INDEX ix_challenges_invited ON challenges (invited_user_id)"))
            connection.execute(text("CREATE INDEX ix_challenges_match ON challenges (match_id)"))
            connection.execute(text("CREATE UNIQUE INDEX ix_challenges_token ON challenges (share_token)"))
        return

    # Table exists — add invited_user_id if missing
    cols = {c["name"] for c in inspector.get_columns("challenges")}
    if "invited_user_id" not in cols:
        with engine.begin() as connection:
            connection.execute(text(
                "ALTER TABLE challenges ADD COLUMN invited_user_id UUID REFERENCES users(id)"
            ))
            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_challenges_invited ON challenges (invited_user_id)"
            ))


def ensure_toss_stake_schema(engine) -> None:
    """Add stake column to toss_plays (variable bidding)."""
    inspector = inspect(engine)
    if "toss_plays" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("toss_plays")}
    if "stake" not in cols:
        with engine.begin() as connection:
            connection.execute(text(
                "ALTER TABLE toss_plays ADD COLUMN stake INTEGER NOT NULL DEFAULT 100"
            ))


def ensure_poller_events_schema(engine) -> None:
    """Create poller_events table for job run logging."""
    inspector = inspect(engine)
    if "poller_events" not in inspector.get_table_names():
        with engine.begin() as connection:
            connection.execute(text("""
                CREATE TABLE poller_events (
                    id         SERIAL PRIMARY KEY,
                    job_type   VARCHAR NOT NULL,
                    match_id   UUID REFERENCES matches(id) ON DELETE CASCADE,
                    status     VARCHAR NOT NULL,
                    detail     VARCHAR,
                    payload    JSONB,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """))
            connection.execute(text(
                "CREATE INDEX ix_poller_events_created ON poller_events (created_at DESC)"
            ))
            connection.execute(text(
                "CREATE INDEX ix_poller_events_match ON poller_events (match_id)"
            ))


def ensure_prediction_settled_at_schema(engine) -> None:
    """predictions.settled_at — when pick was scored; ledger UI uses this instead of created_at."""
    inspector = inspect(engine)
    if "predictions" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("predictions")}
    if "settled_at" in cols:
        return
    dialect = engine.dialect.name
    with engine.begin() as connection:
        if dialect == "postgresql":
            connection.execute(
                text("ALTER TABLE predictions ADD COLUMN settled_at TIMESTAMPTZ")
            )
            connection.execute(
                text("""
                    UPDATE predictions AS p
                    SET settled_at = m.start_time
                    FROM matches AS m
                    WHERE p.match_id = m.id
                      AND p.is_correct IS NOT NULL
                      AND p.settled_at IS NULL
                """)
            )
        else:
            connection.execute(
                text("ALTER TABLE predictions ADD COLUMN settled_at TIMESTAMP")
            )
            connection.execute(
                text("""
                    UPDATE predictions
                    SET settled_at = (
                        SELECT start_time FROM matches WHERE matches.id = predictions.match_id
                    )
                    WHERE is_correct IS NOT NULL AND settled_at IS NULL
                """)
            )


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
