import os
from dotenv import load_dotenv

load_dotenv()  # Load HF_TOKEN and other env vars from .env

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import librosa
import io
import numpy as np

from . import models
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
    return {"status": "ok", "version": APP_VERSION}


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
    transcript = models.get_whisper().transcribe(audio_array, 16000)

    # 2. Emotion classification
    emotion_result = models.get_emotion().classify(audio_array, 16000)

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