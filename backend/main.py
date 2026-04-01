import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from database import engine, Base
from schema_migrations import ensure_match_schema_upgrades

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_match_schema_upgrades(engine)
    yield


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


@app.get("/health/cricapi", tags=["system"])
def health_cricapi():
    """One cached currentMatches call; does not expose CRICAPI_KEY."""
    if not os.getenv("CRICAPI_KEY"):
        return JSONResponse(
            status_code=503,
            content={"status": "error", "cricapi": "not_configured"},
        )
    from cricapi import CricAPIError, fetch_current_matches

    try:
        matches = fetch_current_matches()
        return {
            "status": "ok",
            "cricapi": "ok",
            "current_matches_count": len(matches),
        }
    except CricAPIError as e:
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

app.include_router(users_router, prefix="/users", tags=["users"])
app.include_router(matches_router, prefix="/matches", tags=["matches"])
app.include_router(predictions_router, prefix="/predictions", tags=["predictions"])
app.include_router(leaderboard_router, prefix="/leaderboard", tags=["leaderboard"])
app.include_router(squads_router, prefix="/squads", tags=["squads"])
