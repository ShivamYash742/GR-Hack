# Silent Co-Driver — Day 2 Master Execution Prompt (Tue 11 Aug)

> **Pre-Flight Notice:** Before running this prompt, ensure `CLAUDE.md` in the repository root reflects the Day 1 corrections (`racing_number` maps directly to OpenF1 `driver_number`; `mapping/driver_ids.py` static dict is dead code).

---

## 1. Day 1 Reality Check & Handover Summary

Confirmed from codebase inspection and Day 1 execution logs:

- **Backend Architecture (`backend/app/`)**:
  - `models/whisper.py`: Whisper-small pipeline running locally via Hugging Face Transformers.
  - `models/emotion.py`: `ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition` loaded via `facebook/wav2vec2-large-xlsr-53` feature extractor.
  - `openf1/`: 3-hop lookup (`sessions.py` -> `drivers.py` -> `laps.py`) + session tertile fallback.
  - `schemas/analysis.py`: Defines `AnalyzeResponse`, `EmotionResult`, and `LapResult`.
  - `main.py`: `POST /analyze` accepts audio file (`.wav`/`.mp3`) + form fields (`driver_id`, `grand_prix`, `session_date`, `message_timestamp`, `racing_number`).
- **Verified Correlation**: 5/5 test clips achieved exact lap matches via `racing_number` -> `driver_number` direct validation.
- **Emotion Model Reality**: Uniform ~0.13 confidence across all 8 RAVDESS labels on real broadcast radio. **This is a domain gap, not a bug.** The frontend MUST handle low confidence transparently rather than presenting labels with false certainty.
- **Frontend Starting Point**: Fresh Next.js App Router workspace in `frontend/`.
- **Not yet built, added today**: CORS and `/health` were not part of Day 1's scope — `main.py` currently has neither. Step 1 below adds both; this isn't a Day 1 gap, it's new Day 2 work.

---

## 2. Master Execution Prompt — Paste into AI Coding Assistant

```markdown
You are completing Day 2 for "Silent Co-Driver": building a high-impact Next.js + Tailwind + Recharts frontend, deploying the app, and creating transparent, competition-ready documentation.

Read `CLAUDE.md` and `backend/app/schemas/analysis.py` before writing code to verify exact API schemas and hard rules.

Execute the following 10 structured tasks in strict order:

---

### Step 1: Enable CORS & Add Health Check in Backend
- File target: `backend/app/main.py`
- Add `CORSMiddleware` to `app` allowing all origins (`allow_origins=["*"]`), methods (`["*"]`), and headers (`["*"]`) so the Next.js frontend can make cross-origin requests locally and in production.
- Verify `GET /health` returns `{"status": "ok", "version": "0.1.0"}` for backend warm-up checks.

---

### Step 2: Define Frontend TypeScript Types & API Client
- File targets:
  - `frontend/src/types/analysis.ts`
  - `frontend/src/lib/api.ts`
- Create TypeScript types matching the backend response:
  ```typescript
  export interface EmotionResult {
    raw_label: string;
    score: number;
    bucket: 'calm' | 'stressed' | 'tired' | string;
  }

  export interface LapResult {
    lap_number?: number | null;
    lap_duration?: number | null;
    method: 'exact' | 'fallback_early' | 'fallback_mid' | 'fallback_late' | 'error';
    driver_mean?: number | null;
    session_mean?: number | null;
    error?: string | null;
  }

  export interface AnalyzeResponse {
    transcript: string;
    emotion: EmotionResult;
    lap: LapResult;
  }

  export interface AnalyzeParams {
    file: File;
    driver_id: string;
    grand_prix: string;
    session_date: string;
    message_timestamp: string;
    racing_number?: number;
  }
  ```
- Implement `analyzeAudio(params: AnalyzeParams)` sending `formData` to `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/analyze`.
- Include error handling for network failures, 400 bad requests, and 500 server timeouts.

---

### Step 3: Pull Real Sample Presets From the Actual Dataset — Do Not Invent Them
- File target: `frontend/src/data/presets.ts`
- **Do not write preset metadata from general F1 knowledge.** "Hamilton at Silverstone 2023" is a plausible-sounding fact, not a confirmed row in MikCil with a real audio clip attached. If a judge clicks a preset and it 404s or silently returns "no lap data" because the row doesn't actually exist, that's Hard Rule #2 territory — presenting something as real that isn't.
- Instead: run a short script against the already-downloaded MikCil dataset (it's cached locally from Sunday's pre-flight run — no need to re-download) that filters to 2023+ rows, picks 3-4 that already produced an exact-lap match in Day 1's test run if that log is available, and dumps their real `id`, `driver_id`, `racing_number`, `grand_prix`, `session_date`, `message_timestamp` verbatim into `presets.ts`. Copy the actual values — don't retype them from memory or paraphrase.
- If Day 1's specific test clips aren't identifiable from logs, query fresh: pick any 3-4 rows with `message_timestamp` year >= 2023, confirm each one independently resolves through the full OpenF1 chain (not just "looks like a 2023 row") before adding it as a preset. A preset that fails live is worse than no presets.
- Each preset also needs its actual audio file bundled or fetchable — check how Day 1's test script loaded clips (`ds[i]["audio"]`) and reuse that path; don't assume a static file exists at a URL that hasn't been created.

---

### Step 4: Build Audio Upload & Metadata Input Component
- File targets:
  - `frontend/src/components/AudioUploader.tsx`
  - `frontend/src/components/MetadataForm.tsx`
- **Features**:
  - Drag-and-drop zone supporting `.wav` and `.mp3` files up to 25MB.
  - HTML5 `<audio>` player preview upon file selection.
  - Preset selector buttons, labeled from the real preset data pulled in Step 3 (e.g. driver + grand_prix from the actual row, not invented names) that auto-fill metadata fields.
  - Form fields for `driver_id`, `racing_number`, `grand_prix`, `session_date`, `message_timestamp`.
  - Multi-stage loading progress bar during submission:
    - Stage 1: "Uploading audio payload..."
    - Stage 2: "Transcribing audio via Whisper..."
    - Stage 3: "Analyzing speech emotion with wav2vec2..."
    - Stage 4: "Querying OpenF1 telemetry chain..."

---

### Step 5: Build Transcript & Honest Emotion Badge Component
- File targets:
  - `frontend/src/components/TranscriptPanel.tsx`
  - `frontend/src/components/EmotionBadge.tsx`
- **Emotion Badge Design** — sector-color chips (see Step 7's palette), not icon badges:
  - `stressed` -> alert-red chip (`#E10600`), used deliberately since it's the palette's one saturated color.
  - `calm` -> sector-green chip (`#00D268`).
  - `tired` -> sector-yellow chip (`#FFD93D`).
  - Label text in the mono face, all-caps, small — a telemetry tag, not a status icon.
- **Honest Confidence Score Tag (Stretch / Domain Gap Handling)**:
  - Display the confidence score (e.g. `13.4%`).
  - If score < 0.25, display a warning pill: `"Low Model Confidence — Broadcast Audio Domain Gap"`.
  - Hover tooltip explaining: *"wav2vec2-lg-xlsr was trained on RAVDESS actor speech. F1 broadcast noise produces lower confidence across raw classes."*

---

### Step 6: Build Recharts Telemetry Lap Correlation Component
- File target: `frontend/src/components/LapCorrelationChart.tsx`
- Implement **3 distinct UI visual states**, using Step 7's sector-color palette consistently with the emotion badge — same visual language across the whole readout:
  1. **Exact Lap Match (`method === "exact"`)**:
     - Display Lap Number, Lap Duration in seconds (e.g., `84.123s`), and delta vs `session_mean` & `driver_mean`, all in the mono face with tabular-nums.
     - Recharts Bar Chart comparing: `[This Lap, Driver Stint Mean, Session Mean]`.
     - Sector-purple tag: `"EXACT MATCH"`.
  2. **Session Tertile Fallback (`method.startsWith("fallback")`)**:
     - Display stint bucket (`Early Session`, `Mid Session`, or `Late Session`).
     - Recharts Bar Chart comparing: `[Driver Bucket Mean, Session Mean]`.
     - Sector-yellow tag: `"APPROXIMATE — SESSION TERTILE"`.
  3. **No Lap Data (`method === "error"` or missing data)**:
     - Clear diagnostic panel: *"No OpenF1 Telemetry Available (Pre-2023 session or unindexed timestamp)"*.
     - Do NOT render empty/broken charts or fake numbers.
     - Muted-label tag (`#6E7681`, not a sector color — this state is an absence, not a result): `"NO MATCH"`.

---

### Step 7: Assemble Main Dashboard Layout — Pit-Wall Telemetry, Not a Marketing Dashboard
- File target: `frontend/src/app/page.tsx` & `frontend/src/app/globals.css`
- Reject the default "dark background + one bright accent" look — it reads as templated regardless of subject, and this subject has its own real visual vocabulary to draw from instead: FIA timing screens, pit-wall telemetry monitors, sector-time displays. Build from that, not from generic SaaS-dashboard conventions.
- **Palette** — named, not generic zinc/red:
  - Base: `#0D1117` (near-black, cooler than pure zinc — closer to a timing-screen backdrop than a dev tool)
  - Panel: `#161B22`, hairline borders `#2A313C` (1px, not rounded-card shadows)
  - Sector-purple (fastest / exact match): `#9D4EDD`
  - Sector-green (on-pace / calm): `#00D268`
  - Sector-yellow (fallback / approximate): `#FFD93D`
  - Alert-red (stressed, used sparingly — this is the one saturated color, reserve it): `#E10600`
  - Body text: `#C9D1D9`, muted labels: `#6E7681`
- **Typography**: a monospace face for anything numeric — lap times, timestamps, driver numbers, confidence scores (`JetBrains Mono` or `IBM Plex Mono`) so figures read like real telemetry, not prose. A plain, restrained sans (`Inter` or system-ui) for everything else. Numbers get tabular-nums so columns of lap times actually align.
- **Signature element**: the emotion badge and lap chart share one visual language borrowed from F1 sector timing — a thin colored bar/chip using the sector-purple/green/yellow/red set above, not icon-driven badges (drop the flame/shield/moon icons from Step 5 — they read as generic status-app iconography, not telemetry). Confidence score renders in the mono face next to it, small, unstyled — a number, not a decoration.
- **Header**: title set in the mono face, all-caps, tight tracking — "SILENT CO-DRIVER" as a callsign, not a marketing wordmark. Backend status pill uses the same sector-color logic (green = online, yellow = cold-starting) instead of a generic colored dot.
- **Layout**: keep the 2-column split (upload/metadata left, results right), but structure the right column like a telemetry readout — transcript in a monospace block like a radio log, emotion + lap chart stacked below it as instrument panels, not floating cards with drop shadows. No rounded-corner cards; hairline borders only.
- **Motion**: skip animated transitions between loading stages beyond a simple text swap — F1 telemetry doesn't animate for effect, and extra motion here reads as decoration rather than function. If anything animates, it's the lap bar chart's bars drawing in on data arrival, once, not looping.
- Before writing CSS: take 30 seconds to confirm none of this collapses back into "dark background, one bright accent, rounded cards" — if it does, that's the generic default reasserting itself, not a decision.

---

### Step 8: Deployment Setup & Cold-Start Logger
- **Frontend (Vercel)**:
  - Ensure `frontend/` builds cleanly via `npm run build`.
  - Provide environment variable `NEXT_PUBLIC_API_BASE_URL`.
- **Backend (Render / Railway / HF)**:
  - Confirm CORS is configured.
  - Check cold-start response latency from `/health` endpoint.
  - Log actual observed response times to note in presentation setup.

---

### Step 9: Write Competition-Ready README.md
- File target: `README.md`
- Sections required:
  1. **Overview & Problem Statement**: F1 race engineer decision-support pipeline combining audio AI and official telemetry.
  2. **Architecture Diagram**: Audio file + metadata -> FastAPI -> Whisper-small + Wav2Vec2 + OpenF1 lookup chain -> Next.js visual dashboard.
  3. **Machine Learning Models**: `openai/whisper-small` for speech-to-text, `ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition` for speech emotion.
  4. **OpenF1 Telemetry Mapping**: Direct `racing_number` -> `driver_number` correlation with session tertile fallback.
  5. **Domain Gap & Technical Honesty**: Explicit disclosure of RAVDESS baseline confidence on broadcast radio (~0.13) and design mitigations.
  6. **Local Development Guide**: Commands for running FastAPI backend and Next.js frontend.

---

### Step 10: Update CLAUDE.md Status & Run Verification
- File target: `CLAUDE.md`
- Mark completed tasks under `Current Status`.
- Record empirical end-to-end test results (e.g. backend response time, frontend build status, deployed URL latency).
```

---

## 3. Post-Execution Verification Checklist

Before declaring Day 2 complete, verify the following:

- [ ] **End-to-End Roundtrip**: Tested with a real MikCil `.wav`/`.mp3` clip from the frontend UI.
- [ ] **Chart 3-State Validation**:
  1. Exact lap match renders lap duration bar vs session mean.
  2. Fallback tertile renders stint mean vs session mean with fallback indicator.
  3. Pre-2023 clip displays "No Telemetry Data" cleanly without crashing.
- [ ] **Emotion Model Honesty**: Confidence score is rendered and low-confidence domain gap callout is visible.
- [ ] **Production Deployment**: Frontend deployed to Vercel, backend accessible via public URL with CORS enabled.
- [ ] **Pitch Rehearsal Ready**: 3-minute demo flow rehearsed using pre-warmed backend endpoint.

---

## 4. 3-Minute Demo Pitch Structure

1. **The Hook (30s)**: "In F1, race engineers have seconds to judge driver stress under pressure. Text transcripts lose voice tone, while raw telemetry lacks psychological context."
2. **The Solution (60s)**: Demo live audio upload. Show real-time Whisper transcript, wav2vec2 emotion badge, and OpenF1 telemetry lap bracket overlay.
3. **Technical Honesty & AI Rigor (40s)**: Explain the OpenF1 3-hop lookup engine, session tertile fallback, and transparent handling of the RAVDESS domain gap on broadcast radio.
4. **Live Demo / Wrap (50s)**: Run one of the real dataset-sourced presets from Step 3 on the deployed production URL.
