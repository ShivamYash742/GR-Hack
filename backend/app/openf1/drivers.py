import logging
import requests
from functools import lru_cache
from typing import FrozenSet

logger = logging.getLogger(__name__)

OPENF1_BASE_URL = "https://api.openf1.org/v1"
OPENF1_TIMEOUT = 10  # seconds


@lru_cache(maxsize=32)
def get_valid_driver_numbers(session_key: int) -> FrozenSet[int]:
    """Fetch valid driver numbers for a session. Cached since historical data is immutable."""
    try:
        resp = requests.get(
            f"{OPENF1_BASE_URL}/drivers",
            params={"session_key": session_key},
            timeout=OPENF1_TIMEOUT,
        )
        data = resp.json()
        if not isinstance(data, list):
            return frozenset()
        return frozenset(d.get("driver_number") for d in data if d.get("driver_number") is not None)
    except Exception as e:
        logger.warning("get_valid_driver_numbers failed for session=%s: %s", session_key, e)
        return frozenset()