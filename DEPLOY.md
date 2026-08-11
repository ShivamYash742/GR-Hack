# DEPLOY.md — Day 2 deploy readypack

This is the 30-minute deploy. Two services to ship:

1. **Backend** → Render (free tier Docker Web Service)
2. **Frontend** → Vercel (any plan, free is fine)

Both pieces are pre-built; no source edits needed at deploy time.

---

## 0. Prereqs

- GitHub repo with `main` branch (already pushed).
- Render account (https://render.com).
- Vercel account (https://vercel.com).
- After deploy: a warm-up window of at least 5 minutes because the
  free-tier Render service spins down after 15 min idle, and the first
  cold start downloads Whisper-small + wav2vec2 (~2 GB total, ~30–90 s).

---

## 1. Deploy backend to Render

### Option A — Blueprint (one click)

1. Render dashboard → **New** → **Blueprint**.
2. Connect this repo. Render reads `render.yaml` from the root and
   provisions the `silent-co-driver-backend` Docker service automatically.
3. Wait ~5 min for the first build. The Docker layer caches
   `requirements-prod.txt` so re-builds are fast.
4. After the service is up, hit
   `https://silent-co-driver-backend.onrender.com/health` — expect
   `{"status":"ok","version":"0.1.0","demo_mode":true}` on Render free tier.
5. **Copy the public URL** — you'll paste it into Vercel.

If Blueprint detection fails (often the case on free Render), fall back
to Option B.

### Option B — Manual Web Service

1. Render dashboard → **New** → **Web Service** → pick this repo.
2. **Root Directory:** `backend`.
3. **Runtime:** Docker.
4. **Dockerfile Path:** `Dockerfile` (auto-detected).
5. **Plan:** Free.
6. **Health Check Path:** `/health`.
7. **Env vars** (Advanced → Add Environment Variable):
   - `PYTHONUNBUFFERED=1`
   - `HF_HOME=/opt/render/.cache/huggingface`
   - `SILENT_CO_DRIVER_DEMO_MODE=1`
8. Click **Create Web Service**. Wait for first build.
9. Copy the service URL.

---

## 2. Deploy frontend to Vercel

1. Vercel dashboard → **Add New…** → **Project**.
2. Import this repo. Vercel auto-detects the Next.js framework.
3. **Root Directory:** `frontend` (set this in *Project Settings → Build
   & Development Settings* — Vercel's default monorepo pickup walks down
   to `frontend/package.json` automatically, but be explicit).
4. **Env vars** (Project Settings → Environment Variables):
   | key | value |
   |---|---|
   | `NEXT_PUBLIC_API_BASE_URL` | the full Render URL from step 1, including `https://` and no trailing slash |

5. Click **Deploy**. ~1 min for first build.

---

## 3. Smoke-test the deployed stack

Once both services are up:

1. Open the Vercel URL in a browser.
2. Confirm the header chip says **Backend · 0.1.0** (green), and
   `GET /health` includes `"demo_mode": true` for free-tier Render.
3. Click any of the four preset cards. Expect the transcript,
   emotion badge, and Lap chart to populate in 5–15 s.
4. If the frontend reports "Backend · unreachable", check that the
   Render URL in Vercel's env is correct and that CORS is on (it is —
   see `backend/app/main.py` Step 1).

---

## 4. Demo-day operational notes

- **Warm the backend 5–10 min before presenting.** Hit `/health` once
  from your phone or terminal to trigger the cold start.
- **Pre-cache lap responses.** For each preset driver, run the pipeline
  once and leave the tab open. Per `CLAUDE.md` (Demo-day operational
  notes), this is fine to disclose in README.
- **`SILENT_CO_DRIVER_DEMO_MODE=1`** is the safe-mode flag added in
  `render.yaml` — it prevents the pipeline from ever returning a
  fabricated lap time and keeps the "no lap data" branch honest if
  OpenF1 is unreachable.

---

## 5. Files this step created

| Path | What |
|---|---|
| `backend/requirements-prod.txt` | CPU-only slim requirements (drops CUDA stack) |
| `backend/Dockerfile` | Slim 3.11 base; uses `requirements-prod.txt` |
| `render.yaml` | Render Blueprint at repo root |
| `frontend/.env.example` | Documents `NEXT_PUBLIC_API_BASE_URL` |
| `DEPLOY.md` | This file |
