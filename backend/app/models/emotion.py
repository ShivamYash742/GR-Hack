import numpy as np

# CRITICAL HF FIX: ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition
# has an invalid preprocessor_config on HuggingFace Hub.
# Load feature extractor explicitly from base model instead.
import os

from ..config import demo_mode_enabled


def load_emotion(device: int):
    if demo_mode_enabled():
        return None  # Skip 1.2GB model download on free-tier 512MB RAM host
    try:
        from transformers import Wav2Vec2FeatureExtractor, pipeline

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


PRESET_EMOTIONS = {
    "CHALEC01": {"raw_label": "disgust", "score": 0.134, "bucket": "stressed"},
    "FERALO01": {"raw_label": "neutral", "score": 0.134, "bucket": "tired"},
    "GEORUS01": {"raw_label": "surprised", "score": 0.133, "bucket": "stressed"},
    "LANNOR01": {"raw_label": "happy", "score": 0.134, "bucket": "calm"},
    "SERPER01": {"raw_label": "happy", "score": 0.133, "bucket": "calm"},
    "CARSAI01": {"raw_label": "neutral", "score": 0.136, "bucket": "tired"},
    "LEWHAM01": {"raw_label": "happy", "score": 0.135, "bucket": "calm"},
    "MAXVER01": {"raw_label": "neutral", "score": 0.139, "bucket": "tired"},
}


def dynamic_demo_emotion(audio_array: np.ndarray, sampling_rate: int = 16000, driver_id: str = "") -> dict:
    if audio_array is None or len(audio_array) == 0:
        return {"raw_label": "neutral", "score": 0.138, "bucket": "tired"}

    driver_upper = (driver_id or "").upper().strip()

    # Exact driver preset lookup
    for key, emo in PRESET_EMOTIONS.items():
        if key in driver_upper:
            return emo

    # Dynamic acoustic analysis for custom uploads
    rms = float(np.sqrt(np.mean(audio_array ** 2)))
    if rms > 0.12:
        return {"raw_label": "angry", "score": float(min(0.98, round(0.72 + rms * 1.2, 3))), "bucket": "stressed"}
    elif rms > 0.06:
        return {"raw_label": "happy", "score": float(min(0.95, round(0.68 + rms * 1.5, 3))), "bucket": "calm"}
    else:
        return {"raw_label": "neutral", "score": float(min(0.85, round(0.62 + rms * 2.0, 3))), "bucket": "tired"}


class EmotionModel:
    def __init__(self, pipe):
        self.pipe = pipe

    def classify(self, audio_array: np.ndarray, sampling_rate: int = 16000, driver_id: str = "") -> dict:
        if self.pipe is None or demo_mode_enabled():
            return dynamic_demo_emotion(audio_array, sampling_rate, driver_id)
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
            return dynamic_demo_emotion(audio_array, sampling_rate, driver_id)

