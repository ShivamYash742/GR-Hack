# Re-export from emotion.py to avoid circular imports
from ..models.emotion import MAP_8_TO_3


def map_emotion(label: str) -> str:
    return MAP_8_TO_3.get(label, "tired")