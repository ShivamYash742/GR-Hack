"""Model singletons loaded once at startup via FastAPI lifespan."""
import logging
import os
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI
import torch

# HF Spaces Free Tier has 2 vCPUs. Tuning PyTorch to exactly match this
# prevents thread thrashing and CPU context-switching overhead.
torch.set_num_threads(2)

from .whisper import load_whisper, WhisperModel
from .emotion import load_emotion, EmotionModel

logger = logging.getLogger(__name__)

# These will be initialized on first request (lazy, thread-safe)
_whisper_pipe = None
_emotion_pipe = None
_whisper_lock = threading.Lock()
_emotion_lock = threading.Lock()


def get_device() -> int:
    # Default to CPU (-1) for local stability to prevent CUDA OutOfMemory crashes
    # Pass USE_GPU=1 if running on a dedicated GPU server with sufficient VRAM
    if os.getenv("USE_GPU", "0") == "1" and torch.cuda.is_available():
        return 0
    return -1


def get_whisper():
    global _whisper_pipe
    if _whisper_pipe is None:
        with _whisper_lock:
            # Double-checked locking to prevent duplicate model downloads
            if _whisper_pipe is None:
                logger.info("Loading Whisper model (first request)...")
                device = get_device()
                _whisper_pipe = WhisperModel(load_whisper(device))
                logger.info("Whisper model loaded.")
    return _whisper_pipe


def get_emotion():
    global _emotion_pipe
    if _emotion_pipe is None:
        with _emotion_lock:
            # Double-checked locking to prevent duplicate model downloads
            if _emotion_pipe is None:
                logger.info("Loading emotion model (first request)...")
                device = get_device()
                _emotion_pipe = EmotionModel(load_emotion(device))
                logger.info("Emotion model loaded.")
    return _emotion_pipe


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Do not eager-load models at startup so server binds to port instantly (under 50 MB RAM)
    yield