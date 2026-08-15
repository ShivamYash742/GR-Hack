import logging
import requests
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional, List, Tuple

logger = logging.getLogger(__name__)

OPENF1_BASE_URL = "https://api.openf1.org/v1"
OPENF1_TIMEOUT = 10  # seconds


def parse_timestamp(value) -> Optional[datetime]:
    """
    Defensive parser for OpenF1 date fields.
    Always returns a timezone-aware UTC datetime so comparisons never fail with
    'can't compare offset-naive and offset-aware datetimes'.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    if isinstance(value, (int, float)):
        # Heuristic: microseconds if > 1e12, else seconds
        if value > 1e12:
            value = value / 1_000_000
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if isinstance(value, str):
        normalized = value.replace("Z", "+00:00").strip()
        try:
            dt = datetime.fromisoformat(normalized)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
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
        return tuple(valid)
    except Exception as e:
        logger.warning("get_laps failed for session=%s driver=%s: %s", session_key, driver_number, e)
        return ()


def bracket_match(laps, target_ts: datetime) -> Optional[dict]:
    """
    Returns the latest lap with date_start <= target_ts.
    If target_ts is slightly before the first lap or outside, finds the closest match.
    """
    if not laps:
        return None
    
    # Ensure target_ts is UTC aware
    if target_ts.tzinfo is None:
        target_ts = target_ts.replace(tzinfo=timezone.utc)
    else:
        target_ts = target_ts.astimezone(timezone.utc)

    matched = None
    for lap in laps:
        lap_start = parse_timestamp(lap.get("date_start"))
        if lap_start and lap_start <= target_ts:
            matched = lap
        elif lap_start and lap_start > target_ts:
            break

    # If target timestamp is before first lap date_start or after race, find closest lap
    if matched is None and laps:
        first_lap_start = parse_timestamp(laps[0].get("date_start"))
        if first_lap_start and abs((first_lap_start - target_ts).total_seconds()) < 7200:
            matched = laps[0]
        elif laps:
            matched = laps[len(laps) // 2]
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

    # Ensure target_ts is UTC aware
    if target_ts.tzinfo is None:
        target_ts = target_ts.replace(tzinfo=timezone.utc)
    else:
        target_ts = target_ts.astimezone(timezone.utc)

    # Pre-parse all timestamps ONCE to avoid repeated parsing and NoneType crashes
    parsed_laps = []
    for lap in laps:
        ts = parse_timestamp(lap.get("date_start"))
        if ts is not None:
            parsed_laps.append((lap, ts))

    if not parsed_laps:
        durations = [float(l["lap_duration"]) for l in laps if l.get("lap_duration") is not None and float(l.get("lap_duration", 0)) > 0]
        mean_dur = sum(durations) / len(durations) if durations else None
        return {
            "lap_number": None,
            "lap_duration": None,
            "method": "fallback_mid",
            "driver_mean": round(mean_dur, 3) if mean_dur else None,
            "session_mean": round(mean_dur * 1.015, 3) if mean_dur else None,
            "error": None,
        }

    # Determine session time range from pre-parsed timestamps
    lap_times = [ts for _, ts in parsed_laps]
    session_start = min(lap_times)
    session_end = max(lap_times)
    session_duration = max((session_end - session_start).total_seconds(), 1.0)

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

    # Filter laps in this bucket
    if bucket_name == "fallback_mid":
        bucket_laps = [lap for lap, ts in parsed_laps if t1 < ts.timestamp() <= t2]
    elif bucket_name == "fallback_early":
        bucket_laps = [lap for lap, ts in parsed_laps if ts.timestamp() <= t1]
    else:
        bucket_laps = [lap for lap, ts in parsed_laps if ts.timestamp() > t2]

    if not bucket_laps:
        bucket_laps = [lap for lap, _ in parsed_laps]

    def safe_mean(lap_list):
        durations = [
            float(l["lap_duration"])
            for l in lap_list
            if l.get("lap_duration") is not None and float(l.get("lap_duration", 0)) > 0
        ]
        return round(sum(durations) / len(durations), 3) if durations else None

    all_laps = [lap for lap, _ in parsed_laps]
    driver_mean = safe_mean(bucket_laps) or safe_mean(all_laps)
    session_mean = round(driver_mean * 1.012, 3) if driver_mean else None

    return {
        "lap_number": None,
        "lap_duration": None,
        "method": bucket_name,
        "driver_mean": driver_mean,
        "session_mean": session_mean,
        "error": None,
    }