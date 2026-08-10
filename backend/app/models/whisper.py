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