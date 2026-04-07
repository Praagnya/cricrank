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
# "not found" cooldown to avoid hammering CricAPI with stale ids.
_not_found_cache: dict[str, float] = {}

# match_info / scorecard — lower = fresher line scores (live UX); raise via env if quota tight.
DEFAULT_MATCH_TTL = "20"
DEFAULT_NOT_FOUND_COOLDOWN = "900"  # 15 minutes


def _cache_ttl(env_name: str, default: str) -> float:
    try:
        return float(os.getenv(env_name, default))
    except ValueError:
        return float(default)


class CricAPIError(RuntimeError):
    pass


def _is_not_found_error(message: str) -> bool:
    m = (message or "").lower()
    return "not found" in m and "match" in m


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
    not_found_ttl = _cache_ttl("CRICAPI_NOT_FOUND_COOLDOWN_SECONDS", DEFAULT_NOT_FOUND_COOLDOWN)
    now = time.monotonic()
    with _cache_lock:
        nf_exp = _not_found_cache.get(cache_key)
        if nf_exp and now < nf_exp:
            # Known stale provider id recently returned "not found"; skip remote call.
            return {}
        if cache_key in _match_payload_cache:
            exp, payload = _match_payload_cache[cache_key]
            if now < exp:
                return dict(payload)

    try:
        data = _request(path, id=cricapi_id) or {}
        if not isinstance(data, dict):
            data = {}
        with _cache_lock:
            _not_found_cache.pop(cache_key, None)
            _match_payload_cache[cache_key] = (now + ttl, data)
        return dict(data)
    except CricAPIError as exc:
        if _is_not_found_error(str(exc)):
            with _cache_lock:
                _not_found_cache[cache_key] = now + not_found_ttl
            return {}
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
