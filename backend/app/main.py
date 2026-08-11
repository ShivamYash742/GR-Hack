import os
from dotenv import load_dotenv

load_dotenv()  # Load HF_TOKEN and other env vars from .env

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
import soundfile as sf
import io
import numpy as np

from . import models
from .config import demo_mode_enabled
from .openf1 import correlate
from .schemas.analysis import AnalyzeResponse, EmotionResult, LapResult


APP_VERSION = "0.1.0"

app = FastAPI(title="Silent Co-Driver", version=APP_VERSION, lifespan=models.lifespan)

# CORS — Next.js frontend runs on a different origin locally and in prod.
# Permissive in dev; tighten to known origins once the Vercel URL is fixed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": APP_VERSION,
        "demo_mode": demo_mode_enabled(),
    }


@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return await health()


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

    try:
        # Read contents asynchronously
        contents = await file.read()

        def process_audio_and_correlate():
            from concurrent.futures import ThreadPoolExecutor

            # 0. Decode audio using fast soundfile reader directly (skips heavy librosa resampling)
            try:
                # The frontend sends webm, but we assume it might send standard wav. 
                # If soundfile fails on webm, we fallback to librosa. Since standard Next.js MediaRecorder 
                # produces WebM, we'll try soundfile first, fallback to librosa if necessary.
                audio_array, sr = sf.read(io.BytesIO(contents))
                if len(audio_array.shape) > 1:
                    audio_array = audio_array.mean(axis=1) # Mono
                audio_array = audio_array.astype(np.float32)
                
                # Simple naive resample to 16k if needed (just skipping samples for speed if 48k)
                if sr != 16000:
                    import librosa
                    audio_array = librosa.resample(audio_array, orig_sr=sr, target_sr=16000)
            except Exception:
                # Fallback if it's an unsupported format by soundfile (like WebM)
                import librosa
                audio_array, _ = librosa.load(io.BytesIO(contents), sr=16000, mono=True)
                audio_array = audio_array.astype(np.float32)

            # Run EVERYTHING concurrently (OpenF1 I/O + 2x ML CPU inference)
            # HF Spaces has 2 vCPUs, so we use max_workers=3 (2 for ML, 1 for I/O)
            with ThreadPoolExecutor(max_workers=3) as pool:
                # Submit OpenF1 lookup (I/O bound)
                openf1_future = pool.submit(
                    correlate,
                    driver_id=driver_id,
                    racing_number=racing_number,
                    grand_prix=grand_prix,
                    session_date=session_date,
                    message_timestamp=message_timestamp,
                )

                # Submit ML Inferences (CPU bound)
                whisper_future = pool.submit(
                    models.get_whisper().transcribe, audio_array, 16000, driver_id
                )
                
                emotion_future = pool.submit(
                    models.get_emotion().classify, audio_array, 16000, driver_id
                )

                # Collect results
                transcript_res = whisper_future.result()
                emotion_res = emotion_future.result()
                lap_res = openf1_future.result()

            return transcript_res, emotion_res, lap_res

        transcript, emotion_result, lap_result = await run_in_threadpool(process_audio_and_correlate)

        return AnalyzeResponse(
            transcript=transcript,
            emotion=EmotionResult(**emotion_result),
            lap=LapResult(**lap_result),
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": f"Analysis failed: {str(e)}"}, status_code=500)
