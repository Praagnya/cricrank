# CricRank Deployment Guide

## Architecture

| Layer    | Service  | URL                          |
|----------|----------|------------------------------|
| Frontend | Vercel   | https://cricrank.com         |
| Backend  | Railway  | https://api.cricrank.com     |
| Database | Supabase | (managed, no deploy needed)  |

---

## Prerequisites

- GitHub repo with this codebase pushed
- Supabase project already set up (DB is live)
- Domain `cricrank.com` registered
- Google Cloud project for OAuth
- Anthropic API key

---

## Step 1 — Push to GitHub

Make sure the full repo is pushed. The `.gitignore` excludes `.env*` files — do not commit secrets.

---

## Step 2 — Deploy Backend (Railway)

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. New Project → Deploy from GitHub repo → select this repo
3. Set the **root directory** to `backend/`
4. Railway will detect Python and use `requirements.txt` automatically
5. Set the start command:
   ```
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
6. Add environment variables in Railway dashboard:
   ```
   DATABASE_URL=postgresql://postgres.aexhnenlxuuevcrennnf:...@aws-1-us-east-1.pooler.supabase.com:5432/postgres
   ANTHROPIC_API_KEY=your-anthropic-api-key
   FRONTEND_URL=https://cricrank.com
   ```
7. Deploy — Railway gives you a URL like `https://cricrank-production.up.railway.app`
8. (Optional) Add custom domain `api.cricrank.com` in Railway settings

---

## Step 3 — Deploy Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. New Project → Import from GitHub → select this repo
3. Set the **root directory** to `frontend/`
4. Framework preset: Next.js (auto-detected)
5. Add environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://cricrank-production.up.railway.app
   NEXT_PUBLIC_SUPABASE_URL=https://aexhnenlxuuevcrennnf.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_HWiqny3JRK9rTF3pFNk4ew_1HEPW504
   ```
6. Deploy

---

## Step 4 — Connect Domain (cricrank.com)

1. In Vercel project → Settings → Domains → Add `cricrank.com`
2. Vercel gives you DNS records — go to your domain registrar (Porkbun/GoDaddy)
3. Add the records Vercel provides (usually an A record and CNAME)
4. Wait for DNS propagation (5 min to a few hours)

If using Railway for `api.cricrank.com`:
1. In Railway → Settings → Domains → Add custom domain `api.cricrank.com`
2. Add the CNAME record at your registrar

---

## Step 5 — Configure Supabase OAuth

1. Go to Supabase dashboard → Authentication → URL Configuration
2. Set **Site URL** to `https://cricrank.com`
3. Add to **Redirect URLs**:
   ```
   https://cricrank.com/auth/callback
   ```
4. Go to Authentication → Providers → Google
5. Add your Google OAuth credentials:
   - Client ID and Secret from [console.cloud.google.com](https://console.cloud.google.com)
   - In Google Console, add authorized redirect URI: `https://aexhnenlxuuevcrennnf.supabase.co/auth/v1/callback`

---

## Step 6 — Smoke Test

- [ ] `https://cricrank.com` loads the home page
- [ ] `https://cricrank.com/api/auth/...` — not applicable (Supabase handles auth)
- [ ] Sign in with Google works and redirects back to `cricrank.com`
- [ ] `https://api.cricrank.com/health` returns `{"status": "ok"}`
- [ ] Match predictions can be submitted
- [ ] Leaderboard loads

---

## Environment Variables Reference

### Backend (Railway)
| Variable          | Description                        |
|-------------------|------------------------------------|
| `DATABASE_URL`    | Supabase Postgres session pooler URL |
| `ANTHROPIC_API_KEY` | For AI match predictions         |
| `FRONTEND_URL`    | `https://cricrank.com` (for CORS)  |

### Frontend (Vercel)
| Variable                                    | Description                  |
|---------------------------------------------|------------------------------|
| `NEXT_PUBLIC_API_URL`                       | Railway backend URL          |
| `NEXT_PUBLIC_SUPABASE_URL`                  | Supabase project URL         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anon/public key  |

---

## Redeployment

- **Frontend**: Push to `main` → Vercel auto-deploys
- **Backend**: Push to `main` → Railway auto-deploys
- **DB schema changes**: Run migrations manually via Supabase SQL editor or a migration script
