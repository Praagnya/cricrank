"""One-off: compare match_info vs match_scorecard score[] for a cricapi id (optional env CRICAPI_PROBE_MATCH_ID)."""
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
BASE = "https://api.cricapi.com/v1"
key = os.getenv("CRICAPI_KEY")
if not key:
    print("CRICAPI_KEY missing", file=sys.stderr)
    sys.exit(1)


def get(path: str, **params):
    r = httpx.get(f"{BASE}/{path}", params={"apikey": key, **params}, timeout=30.0)
    r.raise_for_status()
    body = r.json()
    if body.get("status") != "success":
        return None, body.get("reason") or body.get("message") or str(body)
    return body.get("data"), None


def summarize_score(label: str, data) -> None:
    if data is None:
        print(f"  {label}: (no data)")
        return
    if not isinstance(data, dict):
        print(f"  {label}: type={type(data).__name__}")
        return
    sc = data.get("score")
    if not isinstance(sc, list):
        print(f"  {label}: score not a list: {type(sc).__name__}")
        return
    print(f"  {label}: score len={len(sc)} {sc[:2] if sc else '[]'}")


def main():
    mid = os.getenv("CRICAPI_PROBE_MATCH_ID")
    if not mid:
        print("Set CRICAPI_PROBE_MATCH_ID to a match UUID to probe.")
        return

    print(f"=== probe id={mid} ===")
    for ep in ("match_info", "match_scorecard"):
        d, err = get(ep, id=mid)
        if err:
            print(f"  {ep}: ERROR {err}")
        else:
            summarize_score(ep, d)
            if isinstance(d, dict) and d.get("scorecard"):
                print(f"    scorecard innings={len(d['scorecard'])}")


if __name__ == "__main__":
    main()
