import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import engine, Base

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
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
