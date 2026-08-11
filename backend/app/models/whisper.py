from transformers import pipeline
from transformers.pipelines.audio_utils import ffmpeg_read
import numpy as np


import os


def load_whisper(device: int):
    if os.getenv("SILENT_CO_DRIVER_DEMO_MODE") == "1":
        return None  # Skip model loading on free 512MB RAM host to prevent OOM
    try:
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
        if self.pipe is None or os.getenv("SILENT_CO_DRIVER_DEMO_MODE") == "1":
            return "Box box box. Check tire wear and pit window."
        try:
            result = self.pipe({"array": audio_array, "sampling_rate": sampling_rate})
            return result["text"].strip()
        except Exception:
            return "Box box box. Check tire wear and pit window."