import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from database import engine, Base
from schema_migrations import ensure_match_schema_upgrades, ensure_toss_winner_schema, ensure_first_innings_schema, ensure_challenge_schema, ensure_toss_stake_schema, ensure_poller_events_schema, ensure_referral_schema

load_dotenv()

import models  # noqa: F401 — register CoinTransaction etc. before create_all


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_match_schema_upgrades(engine)
    ensure_toss_winner_schema(engine)
    ensure_first_innings_schema(engine)
    ensure_challenge_schema(engine)
    ensure_toss_stake_schema(engine)
    ensure_poller_events_schema(engine)
    ensure_referral_schema(engine)

    from poller import get_scheduler, bootstrap_scheduler, schedule_daily_bootstrap
    from database import SessionLocal
    db = SessionLocal()
    try:
        bootstrap_scheduler(db)
    finally:
        db.close()
    scheduler = get_scheduler()
    schedule_daily_bootstrap(scheduler)
    scheduler.start()

    yield

    scheduler.shutdown(wait=False)


app = FastAPI(
    title="CricGame API",
    version="1.0.0",
    description="Cricket match prediction platform",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://100.70.7.33:3000",
        # Plain HTTP (some clients / redirects) — prefer HTTPS at the edge.
        "http://cricrank.com",
        "http://www.cricrank.com",
        "https://cricrank.com",
        "https://www.cricrank.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "service": "cricgame-api"}


@app.get("/health/poller", tags=["system"])
def poller_health(limit: int = 100, db=None):
    from database import get_db
    from models import PollerEvent, Match
    import inspect as _inspect
    # Accept db via dependency or open one directly (called as plain endpoint)
    from database import SessionLocal
    _db = SessionLocal()
    try:
        rows = (
            _db.query(PollerEvent, Match.team1, Match.team2)
            .outerjoin(Match, PollerEvent.match_id == Match.id)
            .order_by(PollerEvent.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": r.PollerEvent.id,
                "job_type": r.PollerEvent.job_type,
                "match": f"{r.team1} vs {r.team2}" if r.team1 else None,
                "match_id": str(r.PollerEvent.match_id) if r.PollerEvent.match_id else None,
                "status": r.PollerEvent.status,
                "detail": r.PollerEvent.detail,
                "payload": r.PollerEvent.payload,
                "created_at": r.PollerEvent.created_at.isoformat() if r.PollerEvent.created_at else None,
            }
            for r in rows
        ]
    finally:
        _db.close()


@app.get("/health/cricapi", tags=["system"])
def health_cricapi():
    """Hit CricAPI with match_info (dummy id) to verify key + reachability; does not expose CRICAPI_KEY."""
    if not os.getenv("CRICAPI_KEY"):
        return JSONResponse(
            status_code=503,
            content={"status": "error", "cricapi": "not_configured"},
        )
    import httpx

    try:
        r = httpx.get(
            "https://api.cricapi.com/v1/match_info",
            params={
                "apikey": os.environ["CRICAPI_KEY"],
                "id": "00000000-0000-0000-0000-000000000001",
            },
            timeout=15.0,
        )
        r.raise_for_status()
        body = r.json()
        if not isinstance(body, dict) or "status" not in body:
            return JSONResponse(
                status_code=503,
                content={"status": "error", "cricapi": "invalid_response"},
            )
        return {
            "status": "ok",
            "cricapi": "ok",
            "provider_status": body.get("status"),
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "cricapi": "request_failed",
                "detail": str(e),
            },
        )


# ── Routes ────────────────────────────────────────────────────────────────────

from routes.users import router as users_router
from routes.matches import router as matches_router
from routes.predictions import router as predictions_router
from routes.leaderboard import router as leaderboard_router
from routes.squads import router as squads_router
from routes.challenges import router as challenges_router

app.include_router(users_router, prefix="/users", tags=["users"])
app.include_router(matches_router, prefix="/matches", tags=["matches"])
app.include_router(predictions_router, prefix="/predictions", tags=["predictions"])
app.include_router(leaderboard_router, prefix="/leaderboard", tags=["leaderboard"])
app.include_router(squads_router, prefix="/squads", tags=["squads"])
app.include_router(challenges_router, prefix="/challenges", tags=["challenges"])
