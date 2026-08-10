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
from .whisper import load_whisper, WhisperModel
from .emotion import load_emotion, EmotionModel


@asynccontextmanager
async def lifespan(app: FastAPI):
    global whisper_pipe, emotion_pipe
    device = get_device()
    whisper_pipe = WhisperModel(load_whisper(device))
    emotion_pipe = EmotionModel(load_emotion(device))
    yield
    # cleanup if needed