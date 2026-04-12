# cricgame

A web app for cricket matches, predictions, and related game mechanics. The stack is a **FastAPI** backend with PostgreSQL (via SQLAlchemy) and **Supabase**, plus a **Next.js** (React, TypeScript, Tailwind) frontend.

## Layout

- `backend/` — API and scheduled jobs (see `backend/main.py`).
- `frontend/` — Web UI (`npm run dev` for local development).
- `marketing/` — Marketing site (if used separately).

## Local development

**Backend** (from `backend/`):

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend** (from `frontend/`):

```bash
npm install
npm run dev
```

Configure environment variables (database, Supabase, API keys) as required by your deployment; the app expects them at runtime.
