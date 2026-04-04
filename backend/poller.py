"""
Background APScheduler jobs for CricAPI polling.

Toss jobs  : fire at toss_time+5, +10, +35, +40 min per match.
Result jobs: fire at start_time+3h–5h (every 30 min) per match.

Completed matches with a winner but empty result_summary are filled via
match_info (plus a 30-day scan at bootstrap and again at noon UTC).

All one-shot jobs use DateTrigger and run in the scheduler's thread executor.
"""

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Match, MatchStatus, Prediction, FirstInningsPick, PollerEvent, TossPlay

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def _log(db, job_type: str, match_id, status: str, detail: str = None, payload: dict = None):
    """Write a poller_events row. Never raises — logging must not break jobs."""
    try:
        db.add(PollerEvent(
            job_type=job_type,
            match_id=match_id,
            status=status,
            detail=detail,
            payload=payload,
        ))
        db.commit()
    except Exception as exc:
        logger.warning("poller: failed to write log entry: %s", exc)
        try:
            db.rollback()
        except Exception:
            pass

# How long APScheduler will still execute a job that fired while the server was down.
TOSS_MISFIRE_GRACE   = 300   # 5 min — toss window is short
RESULT_MISFIRE_GRACE = 600   # 10 min


def _ensure_autosettle_for_match(db: Session, match: Match) -> None:
    """
    Idempotent safety net: settle toss plays and predictions when DB says the
    outcome is known but a prior job failed or returned early (e.g. completed
    matches skipped the main result-job settlement path).
    """
    from routes.matches import _settle_all_toss_plays_for_match
    from routes.predictions import _settle_match_internal

    try:
        if match.toss_winner:
            unsettled_toss = (
                db.query(TossPlay)
                .filter(TossPlay.match_id == match.id, TossPlay.winning_team.is_(None))
                .count()
            )
            if unsettled_toss > 0:
                logger.info(
                    "poller: autosettle %d toss play(s) for match %s",
                    unsettled_toss,
                    match.id,
                )
                _settle_all_toss_plays_for_match(db, match)
                db.commit()

        if match.status == MatchStatus.completed and match.winner:
            unsettled_pred = (
                db.query(Prediction)
                .filter(Prediction.match_id == match.id, Prediction.is_correct.is_(None))
                .count()
            )
            if unsettled_pred > 0:
                logger.info(
                    "poller: autosettle %d prediction(s) for match %s",
                    unsettled_pred,
                    match.id,
                )
                _settle_match_internal(db, match)
    except Exception as exc:
        logger.error("poller: autosettle failed for match %s: %s", match.id, exc)
        try:
            db.rollback()
        except Exception:
            pass


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
        if not match:
            return

        from routes.matches import _merge_toss_sources, _extract_toss_winner_name, _settle_all_toss_plays_for_match

        if match.toss_winner:
            _ensure_autosettle_for_match(db, match)
            return

        merged = _merge_toss_sources(match)
        tw = _extract_toss_winner_name(merged, match.team1, match.team2)
        if not tw:
            logger.info("poller/toss: winner not yet known for match %s", match_id)
            _log(db, "toss", match.id, "no_data",
                 detail="toss winner not found in CricAPI",
                 payload={"tossWinner": merged.get("tossWinner"), "status": merged.get("status")})
            return

        match.toss_winner = tw
        _settle_all_toss_plays_for_match(db, match)
        db.commit()
        logger.info("poller/toss: settled match %s → toss winner %s", match_id, tw)
        _log(db, "toss", match.id, "settled", detail=f"toss winner: {tw}")
    except Exception as exc:
        logger.error("poller/toss: job failed for %s: %s", match_id, exc)
        _log(db, "toss", None, "error", detail=str(exc))
        db.rollback()
    finally:
        db.close()


def _try_backfill_result_summary(db: Session, match: Match) -> bool:
    """
    Persist CricAPI status line when a match is completed with a winner but
    result_summary was never stored (API sometimes lags behind matchWinner).
    """
    if match.status != MatchStatus.completed or not match.winner or not match.cricapi_id:
        return False
    if match.result_summary and str(match.result_summary).strip():
        return False
    from cricapi import CricAPIError, fetch_match_info

    try:
        info = fetch_match_info(match.cricapi_id) or {}
    except CricAPIError:
        return False
    summary = (info.get("status") or "").strip()
    if not summary:
        summary = f"{match.winner} won"
    match.result_summary = summary
    return True


def _run_backfill_missing_summaries(db: Session, days: int = 30) -> int:
    """Fill result_summary for recent completed matches; returns how many rows updated."""
    now = datetime.now(timezone.utc)
    rows = (
        db.query(Match)
        .filter(
            Match.status == MatchStatus.completed,
            Match.winner != None,
            Match.cricapi_id != None,
            Match.start_time >= now - timedelta(days=days),
        )
        .all()
    )
    filled = 0
    for match in rows:
        if match.result_summary and str(match.result_summary).strip():
            continue
        if _try_backfill_result_summary(db, match):
            db.commit()
            filled += 1
            logger.info("poller: backfilled result_summary for match %s", match.id)
    return filled


# ── Result job ───────────────────────────────────────────────────────────────

def job_check_result(match_id: str) -> None:
    """Update match status/winner from CricAPI and auto-settle when match ends."""
    from cricapi import CricAPIError, fetch_match_bbb, fetch_match_info
    from routes.matches import _find_current_match_payload, _match_status_from_payload
    from team_metadata import canonicalize_winner

    db: Session = SessionLocal()
    try:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match or not match.cricapi_id:
            return
        # Completed + winner: normally nothing to do; still backfill summary if empty.
        if match.status == MatchStatus.completed and match.winner:
            if _try_backfill_result_summary(db, match):
                db.commit()
                logger.info("poller/result: backfilled result_summary for match %s", match_id)
                _log(db, "result", match.id, "summary_backfill",
                     detail=f"result_summary from CricAPI or fallback")
            _ensure_autosettle_for_match(db, match)
            return
        # If completed but winner is null, fall through to recovery logic below.

        payload = _find_current_match_payload(match.cricapi_id) or {}
        if not payload.get("matchStarted"):
            try:
                payload = fetch_match_bbb(match.cricapi_id) or {}
            except CricAPIError:
                payload = {}

        # If match is live in DB but no data from either source, the match has likely
        # ended and dropped off CricAPI's live feed — try match_info directly.
        if not payload and match.status == MatchStatus.live:
            try:
                info = fetch_match_info(match.cricapi_id) or {}
                if isinstance(info, dict) and info:
                    payload = info
            except CricAPIError:
                pass

        # Fallback to match_info when ended but winner still empty
        if payload.get("matchEnded") and not payload.get("matchWinner"):
            try:
                info = fetch_match_info(match.cricapi_id) or {}
                if isinstance(info, dict):
                    for key in ("matchWinner", "matchEnded", "tossWinner"):
                        if not payload.get(key) and info.get(key):
                            payload[key] = info[key]
            except CricAPIError:
                pass

        # Last resort: parse winner from result status text
        # e.g. "Sunrisers Hyderabad won by 65 runs" → matchWinner = "Sunrisers Hyderabad"
        if payload.get("matchEnded") and not payload.get("matchWinner") and payload.get("status"):
            status_text = payload["status"].lower()
            for team in (match.team1, match.team2):
                if team.lower() in status_text and "won" in status_text:
                    payload["matchWinner"] = team
                    break

        log_payload = {
            "matchStarted": payload.get("matchStarted"),
            "matchEnded": payload.get("matchEnded"),
            "matchWinner": payload.get("matchWinner"),
            "tossWinner": payload.get("tossWinner"),
            "status": payload.get("status"),
            "score": payload.get("score"),
        }

        if not payload:
            logger.info("poller/result: no payload yet for match %s", match_id)
            _log(db, "result", match.id, "no_data",
                 detail="all CricAPI sources returned empty (currentMatches, BBB, match_info)")
            return

        changed = False
        new_status = _match_status_from_payload(payload)
        if new_status != match.status:
            match.status = new_status
            changed = True

        if payload.get("matchWinner") and not match.winner:
            match.winner = canonicalize_winner(payload["matchWinner"])
            changed = True

        if new_status == MatchStatus.completed and not (match.result_summary and match.result_summary.strip()):
            summary = (payload.get("status") or "").strip() or None
            if not summary and match.winner:
                summary = f"{match.winner} won"
            if summary:
                match.result_summary = summary
                changed = True

        if changed:
            db.commit()
            logger.info(
                "poller/result: match %s → status=%s winner=%s",
                match_id, match.status, match.winner,
            )

        # Settle toss plays if toss winner now known (safety net for missed toss jobs)
        if not match.toss_winner and payload.get("tossWinner"):
            from routes.matches import _extract_toss_winner_name, _settle_all_toss_plays_for_match
            tw = _extract_toss_winner_name(payload, match.team1, match.team2)
            if tw:
                match.toss_winner = tw
                _settle_all_toss_plays_for_match(db, match)
                db.commit()
                logger.info("poller/result: settled toss for match %s → %s", match_id, tw)
        elif match.toss_winner:
            from routes.matches import _settle_all_toss_plays_for_match
            _settle_all_toss_plays_for_match(db, match)
            db.commit()

        # Auto-settle predictions and challenges once match is complete
        predictions_settled = 0
        if match.status == MatchStatus.completed and match.winner:
            from routes.predictions import _settle_match_internal
            result = _settle_match_internal(db, match)
            predictions_settled = result.get("predictions_updated", 0)
            logger.info("poller/result: auto-settled predictions for match %s", match_id)

        # Settle first innings picks whenever match is live or completed
        fi_settled = 0
        if match.cricapi_id and match.status in (MatchStatus.live, MatchStatus.completed):
            unsettled_fi = (
                db.query(FirstInningsPick)
                .filter(FirstInningsPick.match_id == match.id, FirstInningsPick.actual_score.is_(None))
                .count()
            )
            if unsettled_fi > 0:
                from routes.matches import _settle_first_innings_picks
                _settle_first_innings_picks(db, match)
                try:
                    db.commit()
                    fi_settled = unsettled_fi
                except Exception:
                    db.rollback()
                logger.info("poller/result: settled %d first innings picks for match %s", unsettled_fi, match_id)

        status_label = (
            "settled" if (predictions_settled > 0 or fi_settled > 0)
            else ("live" if match.status == MatchStatus.live else "skipped")
        )
        _log(db, "result", match.id, status_label,
             detail=f"predictions={predictions_settled} fi_picks={fi_settled} winner={match.winner} status={match.status}",
             payload=log_payload)

    except Exception as exc:
        logger.error("poller/result: job failed for %s: %s", match_id, exc)
        try:
            _log(db, "result", None, "error", detail=str(exc))
        except Exception:
            pass
        db.rollback()
    finally:
        db.close()


# ── First innings job ─────────────────────────────────────────────────────────

def job_check_first_innings(match_id: str) -> None:
    """Settle first innings picks - fires around when 1st innings ends (~T+90-120 min)."""
    db: Session = SessionLocal()
    try:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match or not match.cricapi_id:
            return
        unsettled = (
            db.query(FirstInningsPick)
            .filter(FirstInningsPick.match_id == match.id, FirstInningsPick.actual_score.is_(None))
            .count()
        )
        if unsettled == 0:
            _log(db, "fi", match.id, "skipped", detail="no unsettled picks")
            return
        from routes.matches import _settle_first_innings_picks, _get_first_innings_result
        actual_team, actual_score = _get_first_innings_result(match.cricapi_id)
        if actual_score is None:
            _log(db, "fi", match.id, "no_data",
                 detail="first innings not yet complete in CricAPI")
            return
        _settle_first_innings_picks(db, match)
        db.commit()
        logger.info("poller/fi: settled first innings picks for match %s", match_id)
        _log(db, "fi", match.id, "settled",
             detail=f"{actual_team} {actual_score} — settled {unsettled} picks",
             payload={"actual_team": actual_team, "actual_score": actual_score})
    except Exception as exc:
        logger.error("poller/fi: job failed for %s: %s", match_id, exc)
        try:
            _log(db, "fi", None, "error", detail=str(exc))
        except Exception:
            pass
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

    # Early checks at +5/+10; later at +35/+40 (~match start +5/+10) when feed has toss.
    future_fires = [
        toss_time + timedelta(minutes=offset)
        for offset in (5, 10, 35, 40)
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


def _schedule_first_innings_jobs(scheduler: AsyncIOScheduler, match: Match) -> None:
    """Fire at T+90, T+105, T+120 min to catch first innings completion."""
    now = datetime.now(timezone.utc)
    start_time = _utc(match.start_time)
    match_id = str(match.id)

    future_fires = [
        start_time + timedelta(minutes=offset)
        for offset in (90, 105, 120)
        if start_time + timedelta(minutes=offset) > now
    ]

    for fire_at in future_fires:
        offset_min = int((fire_at - start_time).total_seconds() // 60)
        job_id = f"fi_{match_id}_{offset_min}"
        if not scheduler.get_job(job_id):
            scheduler.add_job(
                job_check_first_innings,
                trigger="date",
                run_date=fire_at,
                args=[match_id],
                id=job_id,
                replace_existing=True,
                misfire_grace_time=600,
            )
            logger.info("poller: first innings job %s scheduled at %s", job_id, fire_at.isoformat())


def _schedule_result_jobs(scheduler: AsyncIOScheduler, match: Match) -> None:
    if match.status == MatchStatus.completed:
        return

    now = datetime.now(timezone.utc)
    start_time = _utc(match.start_time)
    match_id = str(match.id)

    future_fires = [
        start_time + timedelta(minutes=offset)
        for offset in (180, 210, 240, 270, 300)   # 3h → 5h, every 30 min
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

    # Log immediately so we know bootstrap ran even if something fails below
    _log(db, "bootstrap", None, "started", detail=f"bootstrap starting at {now.isoformat()}")

    matches = (
        db.query(Match)
        .filter(
            Match.status.in_([MatchStatus.upcoming, MatchStatus.live]),
            Match.start_time <= now + timedelta(days=7),
        )
        .all()
    )

    for match in matches:
        try:
            _schedule_toss_jobs(scheduler, match)
            _schedule_result_jobs(scheduler, match)
            _schedule_first_innings_jobs(scheduler, match)
        except Exception as exc:
            logger.error("poller: failed to schedule jobs for match %s: %s", match.id, exc)

    logger.info("poller: bootstrap done — scheduled jobs for %d matches", len(matches))
    _log(db, "bootstrap", None, "ok",
         detail=f"scheduled jobs for {len(matches)} upcoming/live matches")

    # Recovery: fix completed matches with missing winner or unsettled predictions
    from routes.predictions import _settle_match_internal
    from cricapi import CricAPIError, fetch_match_info
    from team_metadata import canonicalize_winner

    # Also check live matches that may need recovery (e.g. stuck in live with no winner)
    stuck_matches = (
        db.query(Match)
        .filter(
            Match.status.in_([MatchStatus.completed, MatchStatus.live]),
            Match.start_time >= now - timedelta(days=7),
            Match.start_time <= now,  # exclude future matches
        )
        .all()
    )
    for match in stuck_matches:
        try:
            # If winner is missing, try to fetch it from match_info
            if not match.winner and match.cricapi_id:
                try:
                    info = fetch_match_info(match.cricapi_id) or {}
                    mw = info.get("matchWinner")
                    if mw:
                        match.winner = canonicalize_winner(mw)
                        if info.get("matchEnded") and match.status != MatchStatus.completed:
                            match.status = MatchStatus.completed
                        db.commit()
                        logger.warning("poller: recovered winner for match %s → %s", match.id, match.winner)
                except CricAPIError:
                    pass

            if match.winner:
                unsettled = (
                    db.query(Prediction)
                    .filter(Prediction.match_id == match.id, Prediction.is_correct.is_(None))
                    .count()
                )
                if unsettled > 0:
                    logger.warning("poller: re-settling %d unsettled predictions for match %s", unsettled, match.id)
                    _settle_match_internal(db, match)

            # Recover unsettled toss plays (toss winner known but plays not settled)
            if match.toss_winner:
                from models import TossPlay
                unsettled_toss = (
                    db.query(TossPlay)
                    .filter(TossPlay.match_id == match.id, TossPlay.winning_team.is_(None))
                    .count()
                )
                if unsettled_toss > 0:
                    logger.warning("poller: settling %d unsettled toss plays for match %s", unsettled_toss, match.id)
                    from routes.matches import _settle_all_toss_plays_for_match
                    _settle_all_toss_plays_for_match(db, match)
                    try:
                        db.commit()
                    except Exception:
                        db.rollback()

            # Recover stuck first innings picks for completed matches
            if match.cricapi_id:
                unsettled_fi = (
                    db.query(FirstInningsPick)
                    .filter(FirstInningsPick.match_id == match.id, FirstInningsPick.actual_score.is_(None))
                    .count()
                )
                if unsettled_fi > 0:
                    logger.warning("poller: recovering %d unsettled first innings picks for match %s", unsettled_fi, match.id)
                    from routes.matches import _settle_first_innings_picks
                    _settle_first_innings_picks(db, match)
                    try:
                        db.commit()
                    except Exception:
                        db.rollback()
        except Exception as exc:
            logger.error("poller: bootstrap recovery failed for match %s: %s", match.id, exc)
            try:
                db.rollback()
            except Exception:
                pass

    try:
        n = _run_backfill_missing_summaries(db, days=30)
        if n:
            _log(db, "summary_backfill", None, "ok", detail=f"filled {n} result_summary rows")
    except Exception as exc:
        logger.error("poller: bootstrap summary backfill failed: %s", exc)
        try:
            db.rollback()
        except Exception:
            pass


def job_midday_summary_backfill() -> None:
    """Noon UTC: retry summaries in case CricAPI was slow overnight."""
    logger.info("poller: midday summary backfill starting")
    db: Session = SessionLocal()
    try:
        n = _run_backfill_missing_summaries(db, days=30)
        if n:
            _log(db, "summary_backfill", None, "ok", detail=f"midday filled {n} rows")
    except Exception as exc:
        logger.error("poller: midday summary backfill failed: %s", exc)
        try:
            _log(db, "summary_backfill", None, "error", detail=str(exc))
        except Exception:
            pass
        db.rollback()
    finally:
        db.close()
    logger.info("poller: midday summary backfill complete")


def job_daily_bootstrap() -> None:
    """Runs at midnight UTC every day to pick up matches newly within the 7-day window."""
    logger.info("poller: daily bootstrap starting")
    db: Session = SessionLocal()
    try:
        bootstrap_scheduler(db)
    except Exception as exc:
        logger.error("poller: daily bootstrap failed: %s", exc)
        try:
            _log(db, "bootstrap", None, "error", detail=f"daily bootstrap failed: {exc}")
        except Exception:
            pass
    finally:
        db.close()
    logger.info("poller: daily bootstrap complete")


def schedule_daily_bootstrap(scheduler: AsyncIOScheduler) -> None:
    scheduler.add_job(
        job_daily_bootstrap,
        trigger="cron",
        hour=0,
        minute=0,
        id="daily_bootstrap",
        replace_existing=True,
    )
    scheduler.add_job(
        job_midday_summary_backfill,
        trigger="cron",
        hour=12,
        minute=0,
        id="midday_summary_backfill",
        replace_existing=True,
    )
    logger.info("poller: daily midnight bootstrap + midday summary backfill registered")
