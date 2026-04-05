import os
import threading
import time
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "https://api.cricapi.com/v1"

# In-memory TTL caches for per-match endpoints. On transient failure we return last good payload when available.
_cache_lock = threading.Lock()
_match_payload_cache: dict[str, tuple[float, dict[str, Any]]] = {}

# match_info / scorecard — lower = fresher line scores (live UX); raise via env if quota tight.
DEFAULT_MATCH_TTL = "20"


def _cache_ttl(env_name: str, default: str) -> float:
    try:
        return float(os.getenv(env_name, default))
    except ValueError:
        return float(default)


class CricAPIError(RuntimeError):
    pass


def _request(path: str, **params):
    api_key = os.getenv("CRICAPI_KEY")
    if not api_key:
        raise CricAPIError("CRICAPI_KEY is not configured")

    response = httpx.get(
        f"{BASE_URL}/{path}",
        params={"apikey": api_key, **params},
        timeout=30.0,
    )
    response.raise_for_status()
    payload = response.json()

    if payload.get("status") != "success":
        raise CricAPIError(payload.get("reason") or payload.get("message") or "CricAPI request failed")

    return payload.get("data")


def fetch_series_info(series_id: str):
    return _request("series_info", id=series_id)


def _cached_match_request(
    cache_key: str,
    path: str,
    cricapi_id: str,
    ttl_env: str,
    default_ttl: str,
):
    ttl = _cache_ttl(ttl_env, default_ttl)
    now = time.monotonic()
    with _cache_lock:
        if cache_key in _match_payload_cache:
            exp, payload = _match_payload_cache[cache_key]
            if now < exp:
                return dict(payload)

    try:
        data = _request(path, id=cricapi_id) or {}
        if not isinstance(data, dict):
            data = {}
        with _cache_lock:
            _match_payload_cache[cache_key] = (now + ttl, data)
        return dict(data)
    except CricAPIError:
        with _cache_lock:
            if cache_key in _match_payload_cache:
                _, payload = _match_payload_cache[cache_key]
                return dict(payload)
        raise


def fetch_match_scorecard(cricapi_id: str):
    return _cached_match_request(
        f"sc:{cricapi_id}",
        "match_scorecard",
        cricapi_id,
        "CRICAPI_MATCH_SCORECARD_CACHE_SECONDS",
        DEFAULT_MATCH_TTL,
    )


def fetch_match_info(cricapi_id: str):
    return _cached_match_request(
        f"info:{cricapi_id}",
        "match_info",
        cricapi_id,
        "CRICAPI_MATCH_INFO_CACHE_SECONDS",
        DEFAULT_MATCH_TTL,
    )
