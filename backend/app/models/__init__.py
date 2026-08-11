"""Model singletons loaded once at startup via FastAPI lifespan."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
import torch

# These will be initialized in lifespan
whisper_pipe = None
emotion_pipe = None


import os


def get_device() -> int:
    # Default to CPU (-1) for local stability to prevent CUDA OutOfMemory crashes
    # Pass USE_GPU=1 if running on a dedicated GPU server with sufficient VRAM
    if os.getenv("USE_GPU", "0") == "1" and torch.cuda.is_available():
        return 0
    return -1


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