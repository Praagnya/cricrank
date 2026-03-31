import os

import httpx
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "https://api.cricapi.com/v1"


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


def fetch_current_matches():
    data = _request("currentMatches", offset=0)
    return data if isinstance(data, list) else []


def fetch_match_bbb(cricapi_id: str):
    return _request("match_bbb", id=cricapi_id)


def fetch_match_scorecard(cricapi_id: str):
    return _request("match_scorecard", id=cricapi_id)
