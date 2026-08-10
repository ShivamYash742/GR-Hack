from pydantic import BaseModel
from typing import Optional


class EmotionResult(BaseModel):
    raw_label: str
    score: float
    bucket: str


class LapResult(BaseModel):
    lap_number: Optional[int] = None
    lap_duration: Optional[float] = None
    method: str  # "exact" | "fallback_early" | "fallback_mid" | "fallback_late" | "error"
    driver_mean: Optional[float] = None
    session_mean: Optional[float] = None
    error: Optional[str] = None


class AnalyzeResponse(BaseModel):
    transcript: str
    emotion: EmotionResult
    lap: LapResult