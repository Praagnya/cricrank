"""One-off: which CricAPI endpoints expose non-empty score[] for the same match id."""
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
    data, err = get("currentMatches", offset=0)
    if err:
        print("currentMatches failed:", err)
        return
    rows = data if isinstance(data, list) else []
    print(f"currentMatches: {len(rows)} rows")

    # Pick first row with non-empty CM score, and first with empty CM score
    ids_nonempty = next((m["id"] for m in rows if isinstance(m.get("score"), list) and len(m["score"]) > 0), None)
    ids_empty = next((m["id"] for m in rows if isinstance(m.get("score"), list) and len(m["score"]) == 0), None)

    to_probe = []
    if ids_nonempty:
        to_probe.append(("CM_nonempty_score", ids_nonempty))
    if ids_empty:
        to_probe.append(("CM_empty_score", ids_empty))
    if not to_probe and rows:
        to_probe.append(("first_row", rows[0]["id"]))

    for tag, mid in to_probe:
        print(f"\n=== {tag} id={mid} ===")
        cm = next((m for m in rows if m.get("id") == mid), {})
        summarize_score("currentMatches[row]", cm)

        for ep in ("match_info", "match_scorecard"):
            d, err = get(ep, id=mid)
            if err:
                print(f"  {ep}: ERROR {err}")
            else:
                summarize_score(ep, d)
                if isinstance(d, dict) and d.get("scorecard"):
                    print(f"    scorecard innings={len(d['scorecard'])}")
                    for i, inn in enumerate(d["scorecard"][:2]):
                        if isinstance(inn, dict):
                            print(f"      [{i}] totals={inn.get('totals')!r} inning={inn.get('inning')!r}")

    print("\n=== CM vs match_info score mismatch (scanned pages) ===")
    seen: list = []
    for off in (0, 25, 50):
        data, err = get("currentMatches", offset=off)
        if err or not isinstance(data, list):
            break
        seen.extend(data)
    mism = 0
    for m in seen:
        mid = m["id"]
        cm_sc = m.get("score") if isinstance(m.get("score"), list) else []
        inf, err = get("match_info", id=mid)
        if err or not isinstance(inf, dict):
            continue
        in_sc = inf.get("score") if isinstance(inf.get("score"), list) else []
        if len(cm_sc) != len(in_sc) or cm_sc != in_sc:
            mism += 1
            print(f"mismatch {mid[:12]}... CM_len={len(cm_sc)} info_len={len(in_sc)}")
    print(f"total mismatches: {mism} / {len(seen)}")


if __name__ == "__main__":
    main()
