# Marketing — CricRank / CricGame

This folder holds **copy, rhythm, and agent context** for promoting the app. It is separate from app code so you can point **OpenClaw** (or any agent) at these files without touching the backend or frontend.

## What lives here

| Path | Purpose |
|------|---------|
| `openclaw/brand-context.md` | Product summary, voice, links, hashtags — paste into agent memory or `SOUL.md`-style context |
| `openclaw/social-rhythm.md` | Suggested cadence and task ideas for X/Twitter and Instagram |

## OpenClaw (high level)

OpenClaw is an AI agent setup that can automate **drafting**, **scheduling** (via your stack), and **monitoring** social channels when you install the right skills and configure API keys. Typical flow:

1. Install/configure platform skills (e.g. X/Twitter, Instagram) per OpenClaw docs.
2. Store secrets in the agent’s secret store (never commit keys to this repo).
3. Point the agent at `openclaw/brand-context.md` so tone and facts stay consistent.
4. Prefer **draft → human approve → post** until you trust the pipeline.

Official-style guides (external): [OpenClaw Playbook — marketers](https://www.openclawplaybook.ai/guides/openclaw-for-marketers/).

## Repo hygiene

- Do **not** commit API tokens, OAuth secrets, or screenshots with keys.
- Production URLs and handles: keep them in `brand-context.md` (or env) and update when you rebrand.
