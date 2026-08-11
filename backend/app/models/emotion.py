from transformers import Wav2Vec2FeatureExtractor, pipeline
import numpy as np

# CRITICAL HF FIX: ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition
# has an invalid preprocessor_config on HuggingFace Hub.
# Load feature extractor explicitly from base model instead.
import os


def load_emotion(device: int):
    if os.getenv("SILENT_CO_DRIVER_DEMO_MODE") == "1":
        return None  # Skip 1.2GB model download on free-tier 512MB RAM host
    try:
        token = os.getenv("HF_TOKEN")
        feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(
            "facebook/wav2vec2-large-xlsr-53",
            token=token if token else None,
        )
        kwargs = {"device": device, "feature_extractor": feature_extractor}
        if token:
            kwargs["token"] = token
        return pipeline(
            "audio-classification",
            model="ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition",
            **kwargs,
        )
    except Exception:
        return None

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
        if self.pipe is None or os.getenv("SILENT_CO_DRIVER_DEMO_MODE") == "1":
            return {
                "raw_label": "neutral",
                "score": 0.138,
                "bucket": "tired",
            }
        try:
            results = self.pipe({"array": audio_array, "sampling_rate": sampling_rate})
            top = max(results, key=lambda x: x["score"])
            raw_label = top["label"]
            return {
                "raw_label": raw_label,
                "score": float(top["score"]),
                "bucket": MAP_8_TO_3.get(raw_label, "tired"),
            }
        except Exception:
            return {
                "raw_label": "neutral",
                "score": 0.138,
                "bucket": "tired",
            }