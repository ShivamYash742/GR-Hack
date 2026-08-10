# CLAUDE.md — Silent Co-Driver

Read this file completely before doing any work in this repo. It is the
source of truth for every architectural decision below. If something
you're about to do conflicts with this file, stop and flag it rather than
overriding silently.

## Hard rules — do not violate these

1. Do NOT call Hugging Face's hosted Inference API from the main app's
   demo path. Both models run in-process inside the FastAPI backend,
   loaded once at startup. Live external calls are a rate-limit/timeout
   risk during judging.
2. Do NOT fabricate or interpolate lap-time data. If OpenF1 correlation
   fails for a clip, the API/UI says "no lap data" — never a guessed
   number.
3. Do NOT build anything in "Explicitly cut" below without explicit
   sign-off from Shivam. This is a 2-day build, not a 4-day one.
4. ~~Do NOT fuzzy-match driver names against OpenF1 at runtime.~~
   SUPERSEDED 2026-08-10: MikCil's `racing_number` column validates
   directly against OpenF1 `driver_number` — no lookup table needed at
   all. `mapping/driver_ids.py` is dead code, not something to maintain.
   If a row's `racing_number` doesn't validate against `/v1/drivers`,
   treat that row as "no lap data" — don't add fuzzy name-matching.
5. Update "Current Status" at the bottom of this file before ending any
   work session. This is how continuity survives a context reset — a
   fresh session reads this file top to bottom and knows exactly where
   things stand without re-deriving anything.

## Project

F1 team-radio analysis tool for a Hugging Face-focused hackathon. Upload a
radio clip → transcript (Whisper) → emotion classification mapped to
calm/stressed/tired (wav2vec2) → that moment correlated against the
driver's real lap time (OpenF1). Two-model pipeline — "genuine AI work"
via intelligent composition of pretrained models, not training from
scratch.

Team size: 2. Deadline: end of Day 2 (Tue 11 Aug 2026).

## Stack — locked

| Layer | Choice |
|---|---|
| Backend | FastAPI, Python |
| Transcription | `openai/whisper-small`, local via `transformers` |
| Emotion | `ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition`, local |
| Frontend | Next.js (App Router) + Tailwind CSS |
| Charting | Recharts |
| Primary dataset | `MikCil/f1-team-radio` (HF Datasets), filtered to 2023+ |
| Lap-time source | OpenF1 API (`api.openf1.org/v1`) |
| Deploy | Frontend: Vercel. Backend: Render or equivalent. |

## Repo structure

```
silent-co-driver/
├── CLAUDE.md
├── README.md
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, POST /analyze
│   │   ├── models/            # whisper + emotion model wrappers, loaded once
│   │   ├── openf1/            # sessions -> drivers -> laps lookup chain
│   │   └── mapping/
│   │       ├── driver_ids.py  # static MikCil driver_id -> OpenF1 driver_number
│   │       └── emotions.py    # 8-label -> calm/stressed/tired mapping
│   ├── scripts/
│   │   └── verify_pipeline.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/                  # create-next-app, TS + Tailwind + App Router
```

## MVP — non-negotiable, in this order

1. Audio upload (.wav/.mp3 file input) reaches the backend.
2. Whisper transcription returned and displayed.
3. Emotion classification, mapped to calm/stressed/tired, rendered as a badge.
4. Lap-time correlation chart (Recharts): real OpenF1 data where
   available, "no lap data" where not.

Nothing outside this list ships before all four items work end-to-end on
a real MikCil clip.

## Emotion label mapping — locked

Confirmed from the model card: 8 RAVDESS classes.

| Bucket | Model labels |
|---|---|
| stressed | angry, fearful, disgust, surprised |
| calm | calm, happy |
| tired | neutral, sad |

This model was trained on scripted actor speech (RAVDESS), not real
broadcast radio. If real clips cluster on "neutral" with low confidence,
that's the domain gap, not a bug. Fallback: 3-5 custom-recorded scripted
clips (calm/stressed/tired) as controlled proof-of-concept data.

## OpenF1 lookup chain

Three hops, in order:

1. `GET /v1/sessions?year={YYYY}` → filter by `location` or
   `country_name` matching MikCil's `grand_prix` field → get
   `session_key`.
2. MikCil's `racing_number` column → validate directly against
   `GET /v1/drivers?session_key={session_key}` → use as `driver_number`
   if it's in the valid set for that session. Confirmed working 5/5 on
   Day 1 real data. `mapping/driver_ids.py` (the static `driver_id`
   dict) is unused — kept in the repo as a documented dead path, not
   deleted, in case a future row doesn't validate.
3. `GET /v1/laps?session_key={session_key}&driver_number={driver_number}`
   → sort by `date_start` → bracket-match: the last lap whose
   `date_start` is <= the MikCil message timestamp is the lap in progress
   when the radio message was sent. Read `lap_duration` from it.

Known gotchas:
- OpenF1 has documented inconsistency where the same date field can
  return as an ISO string in one response and a Unix microsecond value in
  another. Parse defensively.
- OpenF1's free historical coverage starts in 2023. MikCil clips older
  than that cannot be correlated — filter them out before sampling.

## Fallback — if exact-lap correlation fails for a clip

Bucket the message by its position in the session (early/mid/late) using
the session's `date_start`/`date_end`, then compare that driver's mean lap
time in that bucket against the session mean. Weaker than an exact lap,
still real. Never invent a lap time the API didn't return.

## Emotion model loading gotcha

`ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition`'s own
`preprocessor_config` does not load via `AutoProcessor` (confirmed on the
model's HF discussion thread). Load the feature extractor from
`facebook/wav2vec2-large-xlsr-53` instead:

```python
from transformers import pipeline, Wav2Vec2FeatureExtractor

feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(
    "facebook/wav2vec2-large-xlsr-53"
)
classifier = pipeline(
    "audio-classification",
    model="ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition",
    feature_extractor=feature_extractor,
)
```

Load this and the Whisper pipeline once, at FastAPI startup — not
per-request.

## Explicitly cut — do not build

Multi-clip session view, waveform visualization, engineer alert-threshold
rule engine, per-word color-coded transcript, a separate HF Spaces app
(unless the actual rules document confirms it's required — verify before
building it, don't assume it is).

## Stretch — one item, only after MVP fully works

Confidence score display next to the emotion label. `pipeline()` already
returns the score — this is rendering a number already available, not new
inference work. Attempt anything further only with 3+ hours still on the
clock.

## Day 1 — Mon 10 Aug

| Block | Tasks |
|---|---|
| Morning | FastAPI skeleton, both models loaded locally with correct config. Build `POST /analyze` (audio in → transcript + emotion label + score). Test on 3-5 real MikCil clips from the terminal. |
| Midday–PM | OpenF1 lookup chain as its own module. Wire into `/analyze`. Fallback bucketing as a real branch, not a TODO. |
| Evening | Next.js + Tailwind skeleton. Upload widget → POST → render raw JSON. Full round trip proven. |

## Day 2 — Tue 11 Aug

| Block | Tasks |
|---|---|
| Morning | Transcript panel, emotion badge, Recharts overlay chart. Wired to real backend JSON. |
| Midday | Deploy frontend (Vercel) + backend (Render). Test the deployed URL with a real upload. |
| Early PM | HF Spaces compliance piece, only if confirmed required. 90-minute timebox. |
| PM | Stretch feature. Polish pass (dark theme, F1 accent color) — no new structural work. |
| Evening | README.md (stack, models, data, fallback disclosure). Pitch rehearsal. Run-through on a non-dev device. |

## Demo-day operational notes

- Free-tier hosts spin down when idle — warm the backend 5-10 min before
  presenting.
- Pre-cache the specific OpenF1 lap responses used in the demo in case the
  API is slow/down during judging. Disclose this in the README — normal
  practice, not deception.
- Keep 2-3 untested clips to upload live if a judge asks whether results
  are cherry-picked.

## Commands (once code exists)

```bash
# backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload

# frontend
cd frontend && npm run dev
```

## References

- `MikCil/f1-team-radio` — huggingface.co/datasets/MikCil/f1-team-radio
- `ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition` — huggingface.co/ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition
- OpenF1 API docs — openf1.org/docs
- Full plan with risk register: `Silent_Co-Driver_2-Day_Build_Plan.pdf`

---

## Current Status

Last updated: 2026-08-10, end of Day 2.

### Day 1 — completed
- [x] Pre-flight verification run
- [x] Repo scaffolded
- [x] Backend: models loading correctly (Whisper-small + wav2vec2 in-process, no HF Inference API)
- [x] Backend: `/analyze` endpoint live (5/5 exact-lap matches at smoke time)
- [x] Backend: OpenF1 chain wired in (sessions → drivers → laps with session-tertile fallback)
- [x] HF Spaces piece — VERIFIED not required; cut per "Explicitly cut" rule

### Day 2 — completed (build green; deploy is deployer-action only)
- [x] Backend: CORS + `/health` returns `{status, version}`
- [x] Frontend: TS types + analyzeAudio() client
- [x] Frontend: 4 verified MikCil presets extracted & shipped
- [x] Frontend: AudioUploader + collapsed MetadataForm
- [x] Frontend: TranscriptPanel + EmotionBadge with sector-color chips + low-confidence domain-gap chip
- [x] Frontend: LapCorrelationChart, three states (exact / fallback / no-data)
- [x] Frontend: pit-wall dashboard layout, 2-column. `npm run build` green.
- [x] Deploy readypack — `DEPLOY.md`, Render `Dockerfile`, `render.yaml`, `.env.example`, CPU-only `requirements-prod.txt`
- [x] Stretch: confidence score rendered (was already in Step 5; same chip)
- [x] README.md written for competition

### Pending actions by Shivam
- [ ] Deploy to Render + Vercel following `DEPLOY.md` (manual, ~30 min)
- [ ] Warm backend 5–10 min before each demo run (free tier spins down after 15 min idle)
- [ ] Pitch rehearsal; live run-through on a non-dev device

### Notes / decisions made during build

(Append here as you go — e.g. "Pre-flight found only 40 samples in 2023+,
switched to fallback bucketing as primary." This section is what makes a
fresh session useful instead of guessing.)

2026-08-09: Pre-flight verification completed with key findings:
1. Dataset contains 14,681 total samples, with 6,144 from 2023+ (sufficient for exact-lap correlation)
2. OpenF1 data availability confirmed to start from 2023 (no data for 2018 sample tested)
3. Emotion model loads successfully and returns all 8 RAVDESS labels, but shows low confidence/uniform distribution (~0.11-0.14) on real F1 radio audio, confirming the domain gap noted in the plan
4. The MikCil dataset includes a 'racing_number' column that may correspond to OpenF1 driver_number - needs verification against OpenF1 /v1/drivers endpoint but could eliminate need for static driver_id mapping
5. Part 2 failed on 2018 data (expected, OpenF1 only has 2023+) - will test with 2023+ sample tomorrow

2026-08-10: Day 1 backend implementation complete:
1. Both models (Whisper-small and wav2vec2 emotion) load successfully at startup via FastAPI lifespan
2. `/analyze` endpoint accepts file + Form fields, returns structured JSON with transcript, emotion (raw_label, score, bucket), and lap data
3. OpenF1 correlation engine implemented with 3-hop lookup (session → driver → laps) + session-tertile fallback
4. Test pipeline runs successfully: 5/5 clips tested, 5 exact-lap matches, all succeeded
5. Models show domain gap on real F1 radio (uniform ~0.13 confidence across 8 labels) - as expected from pre-flight

2026-08-10 (correction): Hard Rule #4 and the OpenF1 chain section were
overstated in this file — confirmed `racing_number` resolves
`driver_number` directly for all 5/5 Day 1 test clips, static dict never
triggered. Both sections above are corrected to match. Frontend should
read `driver_number` (or `racing_number`) straight from the `/analyze`
response, not re-derive it.

2026-08-10 (Day 2 ship): Frontend build is green; backend proven at
5/5 exact-lap matches. Deliverables shipped today:
- `backend/requirements-prod.txt` (CPU-only torch; dev `requirements.txt` keeps the CUDA stack for local GPU runs)
- `backend/Dockerfile` (slim 3.11 base)
- `render.yaml` at repo root (Render Blueprint)
- `frontend/.env.example` (`NEXT_PUBLIC_API_BASE_URL` is the only env var)
- `DEPLOY.md` (30-minute walkthrough)
- Expanded `README.md` — architecture diagram, model roles, OpenF1 chain, RAVDESS domain-gap disclosure with the in-UI safety net, repo layout
- `frontend/src/app/page.tsx` pit-wall dashboard layout, two-column with Header/Footer; `npm run build` green
- `SILENT_CO_DRIVER_DEMO_MODE=1` is now set in Render env so the no-lap-data branch never lies

Editor-tool gotcha hit during Step 7: when the bug is a missing/extra `}` adjacent to other special characters, `Edit` can silently no-op. Diagnostic is `awk … | od -c | head` to confirm byte state. Recovery is a one-line `sed -i 's/<pattern>/<fix>/'` — survives embedding the brace inside a JSX expression.