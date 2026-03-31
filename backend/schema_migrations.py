from sqlalchemy import inspect, text


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
