import logging
import requests
from datetime import datetime
from functools import lru_cache
from typing import Optional, List, Tuple

logger = logging.getLogger(__name__)

OPENF1_BASE_URL = "https://api.openf1.org/v1"
OPENF1_TIMEOUT = 10  # seconds


def parse_timestamp(value) -> Optional[datetime]:
    """
    Defensive parser for OpenF1 date fields.
    Handles:
    - ISO-8601 strings: "2023-03-05T15:30:00.000Z" or "2023-03-05T15:30:00+00:00"
    - Unix timestamps (seconds or microseconds, int or float)
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        # Heuristic: microseconds if > 1e12, else seconds
        if value > 1e12:
            value = value / 1_000_000
        return datetime.fromtimestamp(value)
    if isinstance(value, str):
        # Normalize Z suffix
        normalized = value.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            return None
    return None


@lru_cache(maxsize=64)
def get_laps(session_key: int, driver_number: int) -> Tuple[dict, ...]:
    """Fetch laps from OpenF1 API. Results are cached since historical lap data is immutable."""
    try:
        resp = requests.get(
            f"{OPENF1_BASE_URL}/laps",
            params={"session_key": session_key, "driver_number": driver_number},
            timeout=OPENF1_TIMEOUT,
        )
        data = resp.json()
        if not isinstance(data, list):
            return ()
        # Filter laps with valid date_start and lap_duration
        valid = [
            lap for lap in data
            if lap.get("date_start") is not None
            and isinstance(lap.get("lap_duration"), (int, float))
            and lap["lap_duration"] > 0
        ]
        valid.sort(key=lambda l: str(l.get("date_start", "")))
        # Return as tuple for lru_cache hashability (callers treat as list-like)
        return tuple(valid)
    except Exception as e:
        logger.warning("get_laps failed for session=%s driver=%s: %s", session_key, driver_number, e)
        return ()


def bracket_match(laps, target_ts: datetime) -> Optional[dict]:
    """
    Returns the latest lap with date_start <= target_ts.
    """
    matched = None
    for lap in laps:
        lap_start = parse_timestamp(lap.get("date_start"))
        if lap_start and lap_start <= target_ts:
            matched = lap
        else:
            break
    return matched


def fallback_bucket(session_key: int, driver_number: int, target_ts: datetime, laps) -> dict:
    """
    Session-tertile fallback when exact bracket match fails.
    Returns dict matching LapResult schema with method='fallback_<tertile>'.
    """
    if not laps:
        return {
            "lap_number": None,
            "lap_duration": None,
            "method": "error",
            "driver_mean": None,
            "session_mean": None,
            "error": "No lap data available for session",
        }

    # Pre-parse all timestamps ONCE to avoid repeated parsing and NoneType crashes
    parsed_laps = []
    for lap in laps:
        ts = parse_timestamp(lap.get("date_start"))
        if ts is not None:
            parsed_laps.append((lap, ts))

    if not parsed_laps:
        return {"lap_number": None, "lap_duration": None, "method": "error", "driver_mean": None, "session_mean": None, "error": "No valid lap timestamps"}

    # Determine session time range from pre-parsed timestamps
    lap_times = [ts for _, ts in parsed_laps]
    session_start = min(lap_times)
    session_end = max(lap_times)
    session_duration = (session_end - session_start).total_seconds()

    # Tertile boundaries
    t1 = session_start.timestamp() + session_duration / 3
    t2 = session_start.timestamp() + 2 * session_duration / 3
    target_s = target_ts.timestamp()

    if target_s <= t1:
        bucket_name = "fallback_early"
    elif target_s <= t2:
        bucket_name = "fallback_mid"
    else:
        bucket_name = "fallback_late"

    # Filter laps in this bucket using pre-parsed timestamps (safe from NoneType)
    if bucket_name == "fallback_mid":
        bucket_laps = [lap for lap, ts in parsed_laps if t1 < ts.timestamp() <= t2]
    elif bucket_name == "fallback_early":
        bucket_laps = [lap for lap, ts in parsed_laps if ts.timestamp() <= t1]
    else:
        bucket_laps = [lap for lap, ts in parsed_laps if ts.timestamp() > t2]

    driver_laps = [l for l in bucket_laps if l.get("driver_number") == driver_number]

    def mean(lst):
        return sum(lst) / len(lst) if lst else None

    driver_mean = mean([l["lap_duration"] for l in driver_laps])
    session_mean = mean([l["lap_duration"] for l in bucket_laps])

    return {
        "lap_number": None,
        "lap_duration": None,
        "method": bucket_name,
        "driver_mean": driver_mean,
        "session_mean": session_mean,
        "error": f"Exact lap bracket match unavailable; fell back to session {bucket_name.replace('fallback_', '')} statistics",
    }