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


def get_whisper():
    global whisper_pipe
    if whisper_pipe is None:
        device = get_device()
        whisper_pipe = WhisperModel(load_whisper(device))
    return whisper_pipe


def get_emotion():
    global emotion_pipe
    if emotion_pipe is None:
        device = get_device()
        emotion_pipe = EmotionModel(load_emotion(device))
    return emotion_pipe


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Do not eager-load models at startup so server binds to port instantly (under 50 MB RAM)
    yield