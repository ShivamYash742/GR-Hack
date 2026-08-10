# DAY 1 PROMPT — Silent Co-Driver: Model Pipelines & OpenF1 Correlation Engine

> **Context & Pre-Flight Status:** Repo scaffolded. Pre-flight verification completed on `MikCil/f1-team-radio` dataset (6,144 usable 2023+ samples out of 14,681 total). Emotion classification model (`ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition`) loads locally but exhibits a domain gap on raw F1 radio broadcasts (uniform distribution ~0.11-0.14 across 8 RAVDESS categories). OpenF1 API lookup verified active for 2023+ sessions (`api.openf1.org/v1`).
> **Day 1 Goal:** Deliver a fully functional, robust FastAPI `/analyze` endpoint (Audio + Metadata → Whisper Transcript + Emotion Classification & Bucketing + OpenF1 Exact-Lap / Fallback Lap Time Correlation) tested and verified against 3–5 real clips from terminal.

---

## Technical Architecture & Pipeline Flow

```
[ HTTP POST /analyze ]
  ├── Input: file (WAV/MP3 upload) + metadata (separate Form fields)
  ├── 1. Audio Processing: librosa.load(sr=16000, mono=True) -> float32 numpy array
  ├── 2. Speech-to-Text: OpenAI Whisper-Small (Local Transformers Pipeline)
  ├── 3. Emotion Classifier: Wav2Vec2 + 8-to-3 Category Mapper (Local Transformers Pipeline)
  ├── 4. OpenF1 Correlation Engine (3-Hop Lookup with Fallback):
  │     ├── Hop A: Grand Prix + Year -> session_key (/v1/sessions)
  │     ├── Hop B: driver_id / racing_number -> driver_number (/v1/drivers + static map)
  │     ├── Hop C: Lap Bracket Match (/v1/laps sorted by timestamp)
  │     └── Fallback: Session Tertile Bucketing (Early/Mid/Late) if exact lap bracket missing
  └── JSON Response: Structured Payload with Transcript, Emotion Badge, & Lap Context
```

---

## PART 1 — Backbone: Model Loaders & Core API Infrastructure

**File targets:**
- `backend/app/models/whisper.py`
- `backend/app/models/emotion.py`
- `backend/app/models/__init__.py`
- `backend/app/schemas/analysis.py` (new)
- `backend/app/main.py`

**Task:** Load both ML models **once at application startup** (not per-request) and wire the `POST /analyze` endpoint with Pydantic request/response schemas.

### Detailed Requirements & Acceptance Criteria:

#### 1. Model Singleton & Lifespan Management (`backend/app/models/__init__.py`)
```python
"""Model singletons loaded once at startup via FastAPI lifespan."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
import torch

# These will be initialized in lifespan
whisper_pipe = None
emotion_pipe = None

def get_device() -> int:
    return 0 if torch.cuda.is_available() else -1

# Lazy-load helpers (called from lifespan)
from .whisper import load_whisper
from .emotion import load_emotion

@asynccontextmanager
async def lifespan(app: FastAPI):
    global whisper_pipe, emotion_pipe
    device = get_device()
    whisper_pipe = load_whisper(device)
    emotion_pipe = load_emotion(device)
    yield
    # cleanup if needed
```

- Models MUST be loaded **once at startup** via FastAPI `lifespan` context manager in `main.py`.
- Auto-detect CUDA availability (`device = 0` if `torch.cuda.is_available()` else `-1`).
- Expose model instances globally via module-level singletons `whisper_pipe` and `emotion_pipe`.

#### 2. Whisper Model Wrapper (`backend/app/models/whisper.py`)
```python
from transformers import pipeline
from transformers.pipelines.audio_utils import ffmpeg_read
import numpy as np

def load_whisper(device: int):
    return pipeline(
        "automatic-speech-recognition",
        model="openai/whisper-small",
        device=device,
    )

class WhisperModel:
    def __init__(self, pipe):
        self.pipe = pipe

    def transcribe(self, audio_array: np.ndarray, sampling_rate: int = 16000) -> str:
        # Pipeline expects dict with 'array' and 'sampling_rate'
        result = self.pipe({"array": audio_array, "sampling_rate": sampling_rate})
        return result["text"].strip()
```

- `load_whisper(device)` initializes and returns the HF pipeline.
- Wrapper class `WhisperModel` exposes `transcribe(audio_array, sampling_rate)` → clean transcript string.
- `__init__.py` creates `whisper_pipe = WhisperModel(load_whisper(device))`.

#### 3. Emotion Model Wrapper (`backend/app/models/emotion.py`)
```python
from transformers import Wav2Vec2FeatureExtractor, pipeline
import numpy as np

# CRITICAL HF FIX: ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition
# has an invalid preprocessor_config on HuggingFace Hub.
# Load feature extractor explicitly from base model instead.
def load_emotion(device: int):
    feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(
        "facebook/wav2vec2-large-xlsr-53"
    )
    return pipeline(
        "audio-classification",
        model="ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition",
        feature_extractor=feature_extractor,
        device=device,
    )

# 8-to-3 bucket mapping (LOCKED — from CLAUDE.md)
MAP_8_TO_3 = {
    "angry": "stressed", "fearful": "stressed", "disgust": "stressed", "surprised": "stressed",
    "calm": "calm", "happy": "calm",
    "neutral": "tired", "sad": "tired",
}

class EmotionModel:
    def __init__(self, pipe):
        self.pipe = pipe

    def classify(self, audio_array: np.ndarray, sampling_rate: int = 16000) -> dict:
        # Pipeline expects dict with 'array' and 'sampling_rate'
        results = self.pipe({"array": audio_array, "sampling_rate": sampling_rate})
        top = max(results, key=lambda x: x["score"])
        raw_label = top["label"]
        return {
            "raw_label": raw_label,
            "score": float(top["score"]),
            "bucket": MAP_8_TO_3.get(raw_label, "tired"),  # default fallback
        }
```

- `load_emotion(device)` returns pipeline with correct feature extractor.
- Wrapper class `EmotionModel` exposes `classify(audio_array, sampling_rate)` → dict with `raw_label`, `score`, `bucket`.
- `__init__.py` creates `emotion_pipe = EmotionModel(load_emotion(device))`.

#### 4. Pydantic Schemas (`backend/app/schemas/analysis.py`)
```python
from pydantic import BaseModel
from typing import Optional

class EmotionResult(BaseModel):
    raw_label: str
    score: float
    bucket: str

class LapResult(BaseModel):
    lap_number: Optional[int] = None
    lap_duration: Optional[float] = None
    method: str  # "exact" | "fallback_early" | "fallback_mid" | "fallback_late" | "error"
    driver_mean: Optional[float] = None
    session_mean: Optional[float] = None
    error: Optional[str] = None

class AnalyzeResponse(BaseModel):
    transcript: str
    emotion: EmotionResult
    lap: LapResult
```

- Type-safe response contracts. No `Any` types.

#### 5. API Endpoint (`backend/app/main.py`)
```python
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
import librosa
import io
import numpy as np

from .models import whisper_pipe, emotion_pipe
from .openf1 import correlate
from .schemas.analysis import AnalyzeResponse

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Models loaded in models/__init__.py lifespan
    yield

app = FastAPI(title="Silent Co-Driver", version="0.1.0", lifespan=lifespan)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    file: UploadFile = File(...),
    driver_id: str = Form(...),
    grand_prix: str = Form(...),
    session_date: str = Form(...),
    message_timestamp: str = Form(...),
    racing_number: int = Form(None),
):
    # Validate file type
    if not file.filename.lower().endswith((".wav", ".mp3")):
        return JSONResponse({"error": "Only .wav or .mp3 files accepted"}, status_code=400)

    # Read and decode audio
    contents = await file.read()
    audio_array, _ = librosa.load(io.BytesIO(contents), sr=16000, mono=True)
    audio_array = audio_array.astype(np.float32)

    # 1. Transcription
    transcript = whisper_pipe.transcribe(audio_array, 16000)

    # 2. Emotion classification
    emotion_result = emotion_pipe.classify(audio_array, 16000)

    # 3. OpenF1 correlation
    lap_result = correlate(
        driver_id=driver_id,
        racing_number=racing_number,
        grand_prix=grand_prix,
        session_date=session_date,
        message_timestamp=message_timestamp,
    )

    return AnalyzeResponse(
        transcript=transcript,
        emotion=EmotionResult(**emotion_result),
        lap=LapResult(**lap_result),
    )
```

- `POST /analyze` accepts `file` + **separate Form fields** (no JSON string parsing):
  - `driver_id`, `grand_prix`, `session_date`, `message_timestamp` (required)
  - `racing_number` (optional, int)
- Decodes audio using `librosa.load(BytesIO(contents), sr=16000, mono=True)` → float32 array.
- Returns validated `AnalyzeResponse` JSON.

### Standalone Test Command (Part 1)
```bash
cd backend && source venv/bin/activate && python -c "
import numpy as np
from app.models import whisper_pipe, emotion_pipe

# 3 seconds of silence
arr = np.zeros(16000 * 3, dtype=np.float32)
print('Whisper check:', whisper_pipe.transcribe(arr, 16000))
print('Emotion check:', emotion_pipe.classify(arr, 16000))
"
```
Use any 2023+ MikCil clip (download via `datasets` in a quick script) for real testing.

---

## PART 2 — OpenF1 Correlation Engine (Pure Functional Architecture)

**File targets:**
- `backend/app/mapping/driver_ids.py`
- `backend/app/mapping/emotions.py`
- `backend/app/openf1/sessions.py`
- `backend/app/openf1/drivers.py`
- `backend/app/openf1/laps.py`
- `backend/app/openf1/__init__.py`

**Task:** Build pure-functional 3-hop OpenF1 correlation logic with defensive datetime parsing and session-tertile fallback logic.

### Constants
```python
# backend/app/openf1/__init__.py
OPENF1_BASE_URL = "https://api.openf1.org/v1"
OPENF1_TIMEOUT = 10  # seconds
```

### 1. Driver Identification & Lookup (`backend/app/mapping/driver_ids.py`)
```python
# Static lookup dictionary — extend as new driver_ids appear in 2023+ data
DRIVER_ID_TO_NUMBER = {
    "MAXVER01": 1,   # Max Verstappen
    "LEWHAM01": 44,  # Lewis Hamilton
    "CHALEC01": 16,  # Charles Leclerc
    "LANNOR01": 4,   # Lando Norris
    "GEORUS01": 63,  # George Russell
    "CARSAI01": 55,  # Carlos Sainz
    "SERPER01": 11,  # Sergio Perez
    "VALBOT01": 77,  # Valtteri Bottas
    "ESTOCO01": 31,  # Esteban Ocon
    "PIAGAS01": 10,  # Pierre Gasly
    "FERALO01": 14,  # Fernando Alonso
    "LANSTR01": 18,  # Lance Stroll
    "YUKTSU01": 22,  # Yuki Tsunoda
    "ALBALO01": 23,  # Alexander Albon
    "KRAZHU01": 27,  # Nico Hulkenberg
    "KEVMAG01": 20,  # Kevin Magnussen
    "ZHOGUA01": 24,  # Zhou Guanyu
    "NYCVRI01": 21,  # Nyck de Vries
    "LIAMAW01": 40,  # Liam Lawson
    "LOGSAR01": 2,   # Logan Sargeant
}

def get_driver_number(driver_id: str | None, racing_number: int | None, valid_numbers: set[int] | None = None) -> int | None:
    """
    Priority:
    1. racing_number if provided AND present in OpenF1 valid_numbers for session
    2. driver_id lookup in static dict
    3. None if unresolvable
    """
    if racing_number is not None and valid_numbers is not None and racing_number in valid_numbers:
        return int(racing_number)
    if driver_id and driver_id in DRIVER_ID_TO_NUMBER:
        return DRIVER_ID_TO_NUMBER[driver_id]
    return None
```

### 2. Emotion Mapper (`backend/app/mapping/emotions.py`)
```python
# Re-export from emotion.py to avoid circular imports
from ..models.emotion import MAP_8_TO_3

def map_emotion(label: str) -> str:
    return MAP_8_TO_3.get(label, "tired")
```

### 3. Session Resolver (`backend/app/openf1/sessions.py`)
```python
import requests
from typing import Optional
from . import OPENF1_BASE_URL, OPENF1_TIMEOUT

def find_session_key(year: int, grand_prix: str) -> Optional[int]:
    """
    Queries /v1/sessions?year={year} and matches grand_prix to location/country_name/session_name.
    Returns session_key for Race session if multiple matches, else first match.
    """
    try:
        resp = requests.get(
            f"{OPENF1_BASE_URL}/sessions",
            params={"year": year},
            timeout=OPENF1_TIMEOUT,
        )
        data = resp.json()
        if not isinstance(data, list):
            return None
    except Exception:
        return None

    # Normalize search term: "2023 Bahrain Grand Prix" -> "Bahrain"
    search_term = grand_prix.lower().replace(str(year), "").replace("grand prix", "").strip()

    matches = [
        s for s in data
        if search_term in str(s.get("location", "")).lower()
        or search_term in str(s.get("country_name", "")).lower()
        or search_term in str(s.get("session_name", "")).lower()
    ]

    if not matches:
        return None

    # Prioritize Race session
    race_sessions = [s for s in matches if s.get("session_type") == "Race"]
    if race_sessions:
        return race_sessions[0]["session_key"]
    return matches[0]["session_key"]
```

### 4. Driver Number Validation (`backend/app/openf1/drivers.py`)
```python
import requests
from typing import set
from . import OPENF1_BASE_URL, OPENF1_TIMEOUT

def get_valid_driver_numbers(session_key: int) -> set[int]:
    try:
        resp = requests.get(
            f"{OPENF1_BASE_URL}/drivers",
            params={"session_key": session_key},
            timeout=OPENF1_TIMEOUT,
        )
        data = resp.json()
        if not isinstance(data, list):
            return set()
        return {d.get("driver_number") for d in data if d.get("driver_number") is not None}
    except Exception:
        return set()
```

### 5. Lap Bracket Matching & Defensive Parser (`backend/app/openf1/laps.py`)
```python
import requests
from datetime import datetime
from typing import Optional, List
from . import OPENF1_BASE_URL, OPENF1_TIMEOUT

def parse_timestamp(value) -> Optional[datetime]:
    """
    Defensive parser for OpenF1 date fields.
    Handles:
    - ISO-8601 strings: "2023-03-05T15:30:00.000Z" or "2023-03-05T15:30:00+00:00"
    - Unix timestamps (seconds or microseconds, int or float)
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        # Heuristic: microseconds if > 1e12, else seconds
        if value > 1e12:
            value = value / 1_000_000
        return datetime.fromtimestamp(value)
    if isinstance(value, str):
        # Normalize Z suffix
        normalized = value.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            return None
    return None

def get_laps(session_key: int, driver_number: int) -> List[dict]:
    try:
        resp = requests.get(
            f"{OPENF1_BASE_URL}/laps",
            params={"session_key": session_key, "driver_number": driver_number},
            timeout=OPENF1_TIMEOUT,
        )
        data = resp.json()
        if not isinstance(data, list):
            return []
        # Filter laps with valid date_start and lap_duration
        valid = [
            lap for lap in data
            if lap.get("date_start") is not None
            and isinstance(lap.get("lap_duration"), (int, float))
            and lap["lap_duration"] > 0
        ]
        valid.sort(key=lambda l: str(l.get("date_start", "")))
        return valid
    except Exception:
        return []

def bracket_match(laps: List[dict], target_ts: datetime) -> Optional[dict]:
    """
    Returns the latest lap with date_start <= target_ts.
    """
    matched = None
    for lap in laps:
        lap_start = parse_timestamp(lap.get("date_start"))
        if lap_start and lap_start <= target_ts:
            matched = lap
        else:
            break
    return matched

def fallback_bucket(session_key: int, driver_number: int, target_ts: datetime, laps: List[dict]) -> dict:
    """
    Session-tertile fallback when exact bracket match fails.
    Returns dict matching LapResult schema with method='fallback_<tertile>'.
    """
    if not laps:
        return {
            "method": "error",
            "error": "No lap data available for session",
        }

    # Determine session time range from laps
    lap_times = [parse_timestamp(l.get("date_start")) for l in laps if parse_timestamp(l.get("date_start"))]
    if not lap_times:
        return {"method": "error", "error": "No valid lap timestamps"}

    session_start = min(lap_times)
    session_end = max(lap_times)
    session_duration = (session_end - session_start).total_seconds()

    # Tertile boundaries
    t1 = session_start.timestamp() + session_duration / 3
    t2 = session_start.timestamp() + 2 * session_duration / 3
    target_s = target_ts.timestamp()

    if target_s <= t1:
        bucket_name = "fallback_early"
    elif target_s <= t2:
        bucket_name = "fallback_mid"
    else:
        bucket_name = "fallback_late"

    # Filter laps in this bucket
    bucket_laps = [l for l in laps if t1 < parse_timestamp(l.get("date_start")).timestamp() <= t2] if bucket_name == "fallback_mid" else \
                  [l for l in laps if parse_timestamp(l.get("date_start")).timestamp() <= t1] if bucket_name == "fallback_early" else \
                  [l for l in laps if parse_timestamp(l.get("date_start")).timestamp() > t2]

    driver_laps = [l for l in bucket_laps if l.get("driver_number") == driver_number]

    def mean(lst):
        return sum(lst) / len(lst) if lst else None

    driver_mean = mean([l["lap_duration"] for l in driver_laps])
    session_mean = mean([l["lap_duration"] for l in bucket_laps])

    return {
        "lap_number": None,
        "lap_duration": None,
        "method": bucket_name,
        "driver_mean": driver_mean,
        "session_mean": session_mean,
        "error": f"Exact lap bracket match unavailable; fell back to session {bucket_name.replace('fallback_', '')} statistics",
    }
```

### 6. OpenF1 Main Entrypoint (`backend/app/openf1/__init__.py`)
```python
from datetime import datetime
from typing import Optional
from .sessions import find_session_key
from .drivers import get_valid_driver_numbers
from .laps import get_laps, bracket_match, fallback_bucket
from ..mapping.driver_ids import get_driver_number

def correlate(
    driver_id: str,
    racing_number: Optional[int],
    grand_prix: str,
    session_date: str,
    message_timestamp: str,
) -> dict:
    """
    Coordinates 3-hop lookup: session -> driver -> laps -> bracket match / fallback.
    Always returns dict matching LapResult schema. Never throws uncaught exceptions.
    """
    try:
        # Parse year from session_date (YYYY-MM-DD)
        year = int(session_date[:4])

        # Hop A: Session
        session_key = find_session_key(year, grand_prix)
        if not session_key:
            return {"method": "error", "error": f"No OpenF1 session for {grand_prix} {year}"}

        # Hop B: Driver number
        valid_numbers = get_valid_driver_numbers(session_key)
        driver_number = get_driver_number(driver_id, racing_number, valid_numbers)
        if not driver_number:
            return {"method": "error", "error": f"Driver {driver_id} not resolvable for session {session_key}"}

        # Hop C: Laps
        laps = get_laps(session_key, driver_number)
        if not laps:
            return {"method": "error", "error": f"No laps for driver {driver_number} in session {session_key}"}

        # Parse target timestamp
        target_ts = datetime.fromisoformat(message_timestamp.replace("Z", "+00:00"))

        # Exact bracket match
        matched_lap = bracket_match(laps, target_ts)
        if matched_lap:
            return {
                "lap_number": matched_lap.get("lap_number"),
                "lap_duration": float(matched_lap.get("lap_duration", 0)),
                "method": "exact",
                "driver_mean": None,
                "session_mean": None,
                "error": None,
            }

        # Fallback to session tertile statistics
        return fallback_bucket(session_key, driver_number, target_ts, laps)

    except Exception as e:
        return {"method": "error", "error": f"OpenF1 correlation failed: {str(e)}"}
```

### Standalone Test Command (Part 2)
```bash
cd backend && source venv/bin/activate && python -c "
from app.openf1 import correlate

res = correlate(
    driver_id='MAXVER01',
    racing_number=1,
    grand_prix='Bahrain Grand Prix',
    session_date='2023-03-05',
    message_timestamp='2023-03-05T15:30:00+00:00'
)
print('Correlation Result:', res)
"
```

---

## PART 3 — Wire OpenF1 into `/analyze` + Terminal Test Harness

**File targets:**
- `backend/app/main.py` (already integrated in Part 1)
- `backend/scripts/test_pipeline.py` (new)

### Terminal Pipeline Test Script (`backend/scripts/test_pipeline.py`)
```python
#!/usr/bin/env python3
"""
End-to-end test harness: loads 5 real 2023+ MikCil samples,
runs each through the analyze pipeline, prints ASCII table.
"""
import asyncio
import httpx
import numpy as np
import librosa
import io
from datasets import load_dataset
from datetime import datetime

API_URL = "http://localhost:8000/analyze"

# Pick 5 diverse 2023+ clips manually or filter programmatically
TARGET_DRIVERS = ["MAXVER01", "LEWHAM01", "LANNOR01", "CHALEC01", "GEORUS01"]

async def test_clip(sample, client: httpx.AsyncClient):
    """Run single clip through /analyze and return formatted result."""
    audio_data = sample["audio"]
    array = np.array(audio_data["array"], dtype=np.float32)
    sr = audio_data["sampling_rate"]

    # Prepare multipart form
    buf = io.BytesIO()
    librosa.output.write_wav(buf, array, sr)  # or use soundfile
    buf.seek(0)

    files = {"file": (f"{sample['id']}.wav", buf, "audio/wav")}
    data = {
        "driver_id": sample["driver_id"],
        "grand_prix": sample["grand_prix"],
        "session_date": sample["session_date"],
        "message_timestamp": sample["message_timestamp"],
        "racing_number": str(sample.get("racing_number", "")),
    }

    try:
        resp = await client.post(API_URL, files=files, data=data, timeout=60.0)
        resp.raise_for_status()
        result = resp.json()
        return {
            "clip_id": sample["id"][:20],
            "driver": sample["driver_id"][:4],
            "gp": sample["grand_prix"][:20],
            "transcript": result["transcript"][:28],
            "emotion": f'{result["emotion"]["raw_label"]} ({result["emotion"]["score"]:.2f})',
            "method": result["lap"]["method"],
            "duration": f'{result["lap"]["lap_duration"]:.2f}s' if result["lap"]["lap_duration"] else "N/A",
            "ok": True,
        }
    except Exception as e:
        return {
            "clip_id": sample["id"][:20],
            "driver": sample["driver_id"][:4],
            "gp": sample["grand_prix"][:20],
            "transcript": "ERROR",
            "emotion": str(e)[:28],
            "method": "error",
            "duration": "N/A",
            "ok": False,
        }

async def main():
    print("Loading MikCil dataset...")
    ds = load_dataset("MikCil/f1-team-radio", split="train")

    # Filter 2023+ samples for target drivers
    candidates = []
    for row in ds:
        try:
            year = int(row["session_date"][:4])
            if year >= 2023 and row["driver_id"] in TARGET_DRIVERS:
                candidates.append(row)
                if len(candidates) >= 5:
                    break
        except Exception:
            continue

    if len(candidates) < 3:
        print(f"WARNING: Only found {len(candidates)} 2023+ samples for target drivers")
        # Fallback: any 2023+ samples
        for row in ds:
            try:
                year = int(row["session_date"][:4])
                if year >= 2023:
                    candidates.append(row)
                    if len(candidates) >= 5:
                        break
            except Exception:
                continue

    print(f"Testing {len(candidates)} clips...\n")

    async with httpx.AsyncClient() as client:
        tasks = [test_clip(s, client) for s in candidates]
        results = await asyncio.gather(*tasks)

    # Print ASCII table
    print("=" * 110)
    print(f"{'CLIP ID':<20} | {'DRV':<4} | {'GP':<20} | {'TRANSCRIPT':<30} | {'EMOTION (SCORE)':<20} | {'METHOD':<12} | {'DUR':<8}")
    print("=" * 110)
    exact_count = 0
    for r in results:
        print(f"{r['clip_id']:<20} | {r['driver']:<4} | {r['gp']:<20} | {r['transcript']:<30} | {r['emotion']:<20} | {r['method']:<12} | {r['duration']:<8}")
        if r["method"] == "exact":
            exact_count += 1
    print("=" * 110)
    print(f"\nSummary: {len(results)} clips tested, {exact_count} exact-lap matches, {sum(1 for r in results if r['ok'])} succeeded.")

    # Assertions
    assert len(results) >= 3, "Need at least 3 clips tested"
    assert exact_count >= 1, "Need at least 1 exact-lap match"
    print("\n✅ All acceptance criteria met!")

if __name__ == "__main__":
    asyncio.run(main())
```

### Run Test Harness
```bash
# Terminal 1: Start API server
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Terminal 2: Run test
cd backend && source venv/bin/activate && python scripts/test_pipeline.py
```

**Success Criteria:**
- All 3–5 clips return structured JSON (no 500 errors)
- At least 1 clip resolves to `method: "exact"` with real `lap_duration`
- At least 3 clips complete without uncaught exceptions

---

## Quick Reference — Locked Decisions (Do Not Alter)

| Category | Requirement / Constraint |
|---|---|
| **Inference Location** | 100% Local inside FastAPI backend. No HuggingFace Hosted API calls. |
| **Emotion Feature Extractor** | Must use `facebook/wav2vec2-large-xlsr-53` feature extractor for Wav2Vec2. |
| **Driver Identification** | Match `racing_number` against OpenF1 `/v1/drivers` first; fall back to static `DRIVER_ID_TO_NUMBER`. |
| **OpenF1 Scope** | 2023+ only. Pre-2023 clips return fallback or `"no lap data"`. |
| **Audio Processing** | Monophonic float32 resampled to 16kHz via `librosa.load(..., sr=16000)`. |
| **No Invented Lap Durations** | Exact duration returned ONLY when bracket matched. Never guess numbers. |
| **Model Loading** | Once at startup via FastAPI `lifespan` (module-level singletons). |
| **Metadata Input** | Separate Form fields (not JSON string) — `driver_id`, `grand_prix`, `session_date`, `message_timestamp`, `racing_number`. |
| **Session Selection** | Prioritize `session_type == "Race"` when multiple matches. |

---

## Suggested Execution Sequence

1. **Phase 1 (Models & Schemas ~2h):**
   - Create `app/schemas/analysis.py`
   - Implement `app/models/whisper.py`, `app/models/emotion.py`, `app/models/__init__.py` with lifespan
   - Wire `POST /analyze` in `app/main.py` (without OpenF1 initially)
   - Verify: `python -c "..."` smoke test passes

2. **Phase 2 (OpenF1 Engine ~2h):**
   - Before coding: run quick script to print unique `driver_id` from 2023+ samples; extend `DRIVER_ID_TO_NUMBER`
   - Implement `app/mapping/driver_ids.py`, `app/mapping/emotions.py`
   - Implement `app/openf1/sessions.py`, `app/openf1/drivers.py`, `app/openf1/laps.py`, `app/openf1/__init__.py`
   - Test each function standalone via Python CLI

3. **Phase 3 (Integration & Verification ~1h):**
   - Ensure `/analyze` calls `openf1.correlate()` (already wired in Part 1)
   - Create `scripts/test_pipeline.py`
   - Start `uvicorn app.main:app --reload`
   - Run test harness: `python scripts/test_pipeline.py`
   - Verify acceptance criteria met

---

## Hard Stops & Rules of Engagement

- ❌ Do NOT call Hugging Face hosted Inference API.
- ❌ Do NOT create placeholder or synthetic lap durations for exact matches.
- ❌ Do NOT perform live fuzzy matching on driver names.
- ❌ Do NOT load models per HTTP request. Load once during startup via lifespan.
- ❌ Do NOT build frontend visualizers (waveform, charts) during Day 1 backend task.
- ❌ Do NOT add extra dependencies beyond locked stack.
- ❌ Do NOT modify CLAUDE.md during Day 1 (only update status at end of day).