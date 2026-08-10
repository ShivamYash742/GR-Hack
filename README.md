# Silent Co-Driver

**A two-model AI pipeline that turns an F1 team-radio clip into a
timestamped, lap-correlated stress signal.**

Upload a clip of a driver talking on team radio. The pipeline:

1. **Transcribes** the audio with Whisper-small.
2. **Classifies** the speaker's emotion with wav2vec2-large-xlsr, and
   maps the 8 RAVDESS raw classes down to **calm / stressed / tired**.
3. **Correlates** the moment in the session against that driver's real
   lap time via OpenF1 — either an exact lap match (`exact`) or a
   session-tertile mean comparison (`fallback_…`).

If OpenF1 has no data for the session (pre-2023, unindexed timestamp,
API down), the UI renders a **"no lap data"** panel with a reason
field. The pipeline never invents lap times.

---

## Demo

Open the deployed frontend (link in `DEPLOY.md`) and click any of the
four preset cards on the left. Each one is a real, verified MikCil
row from the **2023 Bahrain Grand Prix** that resolves through the live
OpenF1 chain end-to-end.

---

## Architecture

```
┌─────────────┐    multipart    ┌────────────────────────────────────┐
│   Browser   │ ──────────────► │           FastAPI backend          │
│  (Next.js)  │ ◄────────────── │                                    │
└─────────────┘   analyzed JSON  │  ┌──────────────────────────────┐  │
                                 │  │ Whisper-small (in-process)   │  │
                                 │  └──────────────────────────────┘  │
                                 │  ┌──────────────────────────────┐  │
                                 │  │ wav2vec2 emotion (in-proc)   │  │
                                 │  └──────────────────────────────┘  │
                                 │  ┌──────────────────────────────┐  │
                                 │  │ OpenF1 lookup chain at req-  │  │
                                 │  │ uest time → sessions/driver  │  │
                                 │  │ /laps ─────────────────────► │ ─┼─► api.openf1.org
                                 │  └──────────────────────────────┘  │
                                 └────────────────────────────────────┘
```

- **No Hugging Face Inference API calls** in the demo path. Both models
  load once at FastAPI startup and run in-process. This is by design —
  the dream of fast, hosted HF inference does not survive a judge's
  upload during demo.
- **Static `racing_number` ↔ OpenF1 `driver_number`.** No name fuzzy
  matching. Real rows only.
- **Demo safe-mode (`SILENT_CO_DRIVER_DEMO_MODE=1`)** forces the lap
  correlation to refuse fabricated numbers and surface the failure mode
  in the UI.

---

## Models

| Role | HF repo | Runtime |
|---|---|---|
| Transcription | [`openai/whisper-small`](https://huggingface.co/openai/whisper-small) | local `transformers` |
| Emotion | [`ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition`](https://huggingface.co/ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition) | local `transformers` (XLSR feature extractor loaded separately — see CLAUDE.md gotcha) |

### Domain gap — disclosed

The wav2vec2 emotion model was fine-tuned on **RAVDESS** — scripted
actor speech recorded in controlled studio conditions. Real F1 team
radio is broadcast over a noisy intercom, often with the driver's
breathing and engine harmonics in the foreground. On real clips the
model's softmax distribution flattens (peak confidence often 0.11–0.14).

This is a domain gap, not a bug. The UI handles it explicitly:

- any emotion classification with `score < 0.25` triggers a yellow
  **`Low Model Confidence — Broadcast Audio Domain Gap`** chip on the
  badge with the full reason in its tooltip;
- the bucket (calm / stressed / tired) is still surfaced, so the
  qualitative read is preserved while the disclaimer makes the
  confidence honest in front of a judge.

3–5 fallback scripted clips (recorded calm / stressed / tired) are
included as controlled proof-of-concept data under
`backend/scripts/`.

---

## Data

| Source | What |
|---|---|
| [`MikCil/f1-team-radio`](https://huggingface.co/datasets/MikCil/f1-team-radio) | 14,681 historical F1 radio messages, audio + metadata |
| Filter | 2023+ only — OpenF1's free historical tier starts in 2023 |
| Preset audio | 4 verified MikCil rows extracted to `frontend/public/presets/` |
| Preset metadata | `frontend/src/data/presets.ts` — only rows that resolved through the live OpenF1 chain at extract time |
| Lap times | [`OpenF1 API`](https://openf1.org/docs) — `/v1/sessions`, `/v1/drivers`, `/v1/laps` chain |

---

## OpenF1 lookup chain

A clip drives a three-hop query at request time:

```
MikCil driver_id   →   OpenF1 driver_number      (static dict)
MikCil grand_prix  →   OpenF1 session_key         (year + location match)
session_key + driver_number → last lap whose date_start
                              ≤ message_timestamp
                              → lap_duration
```

If the last-lap-before-msg bracket misses, fall back to a session-
tertile (early / mid / late) mean comparison and chip the result as
`fallback_…`. If even the session lookup fails, surface the error code
in the UI's `No OpenF1 telemetry available` panel. We never invent
data.

---

## Fallback pre-cache for demo

Lap responses for the four preset clips are pre-warmed by clicking the
presets before the demo starts. Render's free tier spins down after 15
min idle; pre-warming by hitting `/analyze` once per preset guarantees
~5 s response time during the live demo, even if the OpenF1 API is
slow. This is normal practice and is disclosed above.

---

## Stack

| Layer | Choice |
|---|---|
| Backend | FastAPI, Python 3.11, uvicorn |
| Frontend | Next.js 16, React 19, Tailwind 4, Recharts |
| Transcription | `openai/whisper-small`, local via `transformers` |
| Emotion | `ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition`, local |
| Lap-time source | OpenF1 API (`api.openf1.org/v1`) |
| Deploy | Backend: Render free tier (Docker). Frontend: Vercel. |

---

## Run locally

```bash
# backend
cd backend
source venv/bin/activate         # (or: python -m venv venv && pip install -r requirements.txt)
uvicorn app.main:app --reload    # → http://127.0.0.1:8000

# frontend (separate terminal)
cd frontend
cp .env.example .env.local       # already points at the local backend
npm install                      # first time only
npm run dev                      # → http://127.0.0.1:3000
```

For GPU fast-path locally, the dev `requirements.txt` (CUDA pinned) is
the right thing to install. For Render you want `requirements-prod.txt`
(it's CPU-only, no nvidia-* tooling, ~600 MB after layer cache).

---

## Deploy

See [`DEPLOY.md`](DEPLOY.md) for the 30-minute walkthrough.

---

## What we deliberately did NOT build

To ship a focused 2-day demo, the following were cut and never landed:

- multi-clip session view
- waveform visualization
- engineer alert-threshold rule engine
- per-word color-coded transcript
- a separate HF Spaces app (not required by the rules; we verified
  before deciding not to build it)

All non-MVP scope lives behind a "Stretch" gate in `DAY2_PROMPT.md`.

---

## Repo layout

```
silent-co-driver/
├── CLAUDE.md                # source-of-truth rules & current status
├── DAY1prompt.md            # Day 1 build instructions
├── DAY2_PROMPT.md           # Day 2 build instructions
├── DEPLOY.md                # 30-minute deploy walkthrough
├── README.md                # this file
├── backend/
│   ├── Dockerfile           # Render use
│   ├── requirements.txt     # local GPU dev
│   ├── requirements-prod.txt # Render CPU
│   ├── app/
│   │   ├── main.py
│   │   ├── models/          # whisper + emotion, load-once
│   │   ├── openf1/          # sessions → drivers → laps
│   │   ├── schemas/         # pydantic response shapes
│   │   └── mapping/
│   └── scripts/             # verify_pipeline, extract_presets
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router (page, layout, globals.css)
│   │   ├── components/      # pit-wall telemetry UI
│   │   ├── data/presets.ts  # real MikCil rows only
│   │   ├── lib/api.ts       # analyzeAudio() client
│   │   └── types/analysis.ts # mirrors backend/app/schemas/analysis.py
│   ├── public/presets/      # 4 verified .wav clips
│   ├── .env.example
│   └── CLAUDE.md            # frontend-specific rules
└── render.yaml              # Render Blueprint
```

---

## Credits

- Whisper-small — OpenAI (Apache-2.0).
- wav2vec2 emotion model — `ehcalabres`, RAVDESS-trained (Apache-2.0).
- Dataset — [`MikCil`](https://huggingface.co/datasets/MikCil/f1-team-radio).
- Lap-time source — [OpenF1](https://openf1.org).
- Built for a Hugging Face-focused hackathon, two days, two engineers.
