"""
Background APScheduler jobs for CricAPI polling.

Toss jobs  : fire at toss_time, toss_time+5min, toss_time+10min per match.
Result jobs: fire at start_time+4h, +4.5h, +5h per match.

All jobs use DateTrigger (fire once) and are run in the default thread executor
that AsyncIOScheduler provides for synchronous callables.
"""

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Match, MatchStatus, Prediction

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None

# How long APScheduler will still execute a job that fired while the server was down.
TOSS_MISFIRE_GRACE   = 300   # 5 min — toss window is short
RESULT_MISFIRE_GRACE = 600   # 10 min


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone="UTC")
    return _scheduler


# ── Toss job ─────────────────────────────────────────────────────────────────

def job_check_toss(match_id: str) -> None:
    """Fetch toss result from CricAPI, save to DB, settle all toss plays."""
    db: Session = SessionLocal()
    try:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match or match.toss_winner:
            return

        # Re-use the helpers already written in routes/matches.py
        from routes.matches import _merge_toss_sources, _extract_toss_winner_name, _settle_all_toss_plays_for_match

        merged = _merge_toss_sources(match)
        tw = _extract_toss_winner_name(merged, match.team1, match.team2)
        if not tw:
            logger.info("poller/toss: winner not yet known for match %s", match_id)
            return

        match.toss_winner = tw
        _settle_all_toss_plays_for_match(db, match)
        db.commit()
        logger.info("poller/toss: settled match %s → toss winner %s", match_id, tw)
    except Exception as exc:
        logger.error("poller/toss: job failed for %s: %s", match_id, exc)
        db.rollback()
    finally:
        db.close()


# ── Result job ───────────────────────────────────────────────────────────────

def job_check_result(match_id: str) -> None:
    """Update match status/winner from CricAPI and auto-settle when match ends."""
    from cricapi import CricAPIError, fetch_match_bbb, fetch_match_info
    from routes.matches import _find_current_match_payload, _match_status_from_payload
    from team_metadata import canonicalize_winner

    db: Session = SessionLocal()
    try:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match or match.status == MatchStatus.completed:
            return
        if not match.cricapi_id:
            return

        payload = _find_current_match_payload(match.cricapi_id) or {}
        if not payload.get("matchStarted"):
            try:
                payload = fetch_match_bbb(match.cricapi_id) or {}
            except CricAPIError:
                payload = {}

        # Fallback to match_info for completed matches
        if not payload.get("matchEnded"):
            try:
                info = fetch_match_info(match.cricapi_id) or {}
                if info.get("matchEnded"):
                    payload = {**info, **payload}
            except CricAPIError:
                pass

        if not payload:
            logger.info("poller/result: no payload yet for match %s", match_id)
            return

        changed = False
        new_status = _match_status_from_payload(payload)
        if new_status != match.status:
            match.status = new_status
            changed = True

        if payload.get("matchWinner") and not match.winner:
            match.winner = canonicalize_winner(payload["matchWinner"])
            changed = True

        if payload.get("status") and not match.result_summary and new_status == MatchStatus.completed:
            match.result_summary = payload["status"]
            changed = True

        if changed:
            db.commit()
            logger.info(
                "poller/result: match %s → status=%s winner=%s",
                match_id, match.status, match.winner,
            )

        # Auto-settle predictions and challenges once match is complete
        if match.status == MatchStatus.completed and match.winner:
            from routes.predictions import _settle_match_internal
            _settle_match_internal(db, match)
            logger.info("poller/result: auto-settled predictions for match %s", match_id)

    except Exception as exc:
        logger.error("poller/result: job failed for %s: %s", match_id, exc)
        db.rollback()
    finally:
        db.close()


# ── Scheduling helpers ────────────────────────────────────────────────────────

def _utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _schedule_toss_jobs(scheduler: AsyncIOScheduler, match: Match) -> None:
    if match.toss_winner:
        return

    now = datetime.now(timezone.utc)
    toss_time = _utc(match.toss_time)
    match_id = str(match.id)

    future_fires = [
        toss_time + timedelta(minutes=offset)
        for offset in (5, 10)
        if toss_time + timedelta(minutes=offset) > now
    ]

    if future_fires:
        for fire_at in future_fires:
            job_id = f"toss_{match_id}_{int((fire_at - toss_time).total_seconds() // 60)}"
            if not scheduler.get_job(job_id):
                scheduler.add_job(
                    job_check_toss,
                    trigger="date",
                    run_date=fire_at,
                    args=[match_id],
                    id=job_id,
                    replace_existing=True,
                    misfire_grace_time=TOSS_MISFIRE_GRACE,
                )
                logger.info("poller: toss job %s scheduled at %s", job_id, fire_at.isoformat())
    else:
        # Toss window has passed but winner still unknown — run immediately
        job_id = f"toss_{match_id}_catchup"
        if not scheduler.get_job(job_id):
            scheduler.add_job(
                job_check_toss,
                trigger="date",
                run_date=now + timedelta(seconds=5),
                args=[match_id],
                id=job_id,
                replace_existing=True,
                misfire_grace_time=TOSS_MISFIRE_GRACE,
            )
            logger.info("poller: toss catchup job %s scheduled immediately", job_id)


def _schedule_result_jobs(scheduler: AsyncIOScheduler, match: Match) -> None:
    if match.status == MatchStatus.completed:
        return

    now = datetime.now(timezone.utc)
    start_time = _utc(match.start_time)
    match_id = str(match.id)

    future_fires = [
        start_time + timedelta(minutes=offset)
        for offset in (180, 210, 240)   # 3h, 3.5h, 4h
        if start_time + timedelta(minutes=offset) > now
    ]

    if future_fires:
        for fire_at in future_fires:
            offset_min = int((fire_at - start_time).total_seconds() // 60)
            job_id = f"result_{match_id}_{offset_min}"
            if not scheduler.get_job(job_id):
                scheduler.add_job(
                    job_check_result,
                    trigger="date",
                    run_date=fire_at,
                    args=[match_id],
                    id=job_id,
                    replace_existing=True,
                    misfire_grace_time=RESULT_MISFIRE_GRACE,
                )
                logger.info("poller: result job %s scheduled at %s", job_id, fire_at.isoformat())
    else:
        # Match should be over but status not completed — check immediately
        job_id = f"result_{match_id}_catchup"
        if not scheduler.get_job(job_id):
            scheduler.add_job(
                job_check_result,
                trigger="date",
                run_date=now + timedelta(seconds=10),
                args=[match_id],
                id=job_id,
                replace_existing=True,
                misfire_grace_time=RESULT_MISFIRE_GRACE,
            )
            logger.info("poller: result catchup job %s scheduled immediately", job_id)


# ── Bootstrap ─────────────────────────────────────────────────────────────────

def bootstrap_scheduler(db: Session) -> None:
    """
    Called once at startup and daily at midnight UTC.
    Schedules toss + result jobs for all upcoming/live matches within the next 7 days.
    """
    scheduler = get_scheduler()
    now = datetime.now(timezone.utc)

    matches = (
        db.query(Match)
        .filter(
            Match.status.in_([MatchStatus.upcoming, MatchStatus.live]),
            Match.start_time <= now + timedelta(days=7),
        )
        .all()
    )

    for match in matches:
        _schedule_toss_jobs(scheduler, match)
        _schedule_result_jobs(scheduler, match)

    logger.info("poller: bootstrap done — scheduled jobs for %d matches", len(matches))

    # Re-settle any completed matches that have unsettled predictions (recovery from missed settlement)
    from routes.predictions import _settle_match_internal
    stuck_matches = (
        db.query(Match)
        .filter(
            Match.status == MatchStatus.completed,
            Match.winner.isnot(None),
            Match.start_time >= now - timedelta(days=30),
        )
        .all()
    )
    for match in stuck_matches:
        unsettled = (
            db.query(Prediction)
            .filter(Prediction.match_id == str(match.id), Prediction.is_correct.is_(None))
            .count()
        )
        if unsettled > 0:
            logger.warning("poller: re-settling %d unsettled predictions for completed match %s", unsettled, match.id)
            _settle_match_internal(db, match)


def job_daily_bootstrap() -> None:
    """Runs at midnight UTC every day to pick up matches newly within the 7-day window."""
    db: Session = SessionLocal()
    try:
        bootstrap_scheduler(db)
    finally:
        db.close()


def schedule_daily_bootstrap(scheduler: AsyncIOScheduler) -> None:
    scheduler.add_job(
        job_daily_bootstrap,
        trigger="cron",
        hour=0,
        minute=0,
        id="daily_bootstrap",
        replace_existing=True,
    )
    logger.info("poller: daily midnight bootstrap job registered")
