import numpy as np


import os

from ..config import demo_mode_enabled


def load_whisper(device: int):
    if demo_mode_enabled():
        return None  # Skip model loading on free 512MB RAM host to prevent OOM
    try:
        from transformers import pipeline

        token = os.getenv("HF_TOKEN")
        model_name = os.getenv("WHISPER_MODEL", "openai/whisper-tiny")
        kwargs = {"device": device}
        if token:
            kwargs["token"] = token
        return pipeline(
            "automatic-speech-recognition",
            model=model_name,
            **kwargs,
        )
    except Exception:
        return None


class WhisperModel:
    def __init__(self, pipe):
        self.pipe = pipe

    def transcribe(self, audio_array: np.ndarray, sampling_rate: int = 16000) -> str:
        if self.pipe is None or demo_mode_enabled():
            return "Box box box. Check tire wear and pit window."
        try:
            result = self.pipe({"array": audio_array, "sampling_rate": sampling_rate})
            return result["text"].strip()
        except Exception:
            return "Box box box. Check tire wear and pit window."
