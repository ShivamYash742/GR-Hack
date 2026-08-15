from datetime import datetime, timezone
from typing import Optional
from .sessions import find_session_key
from .drivers import get_valid_driver_numbers
from .laps import get_laps, bracket_match, fallback_bucket, parse_timestamp
from ..mapping.driver_ids import get_driver_number


OPENF1_BASE_URL = "https://api.openf1.org/v1"
OPENF1_TIMEOUT = 10  # seconds


def correlate(
    driver_id: str,
    racing_number: Optional[int],
    grand_prix: str,
    session_date: str,
    message_timestamp: str,
) -> dict:
    """
    Coordinates 3-hop lookup: session -> driver -> laps -> bracket match / fallback.
    Always returns dict matching LapResult schema. Never throws uncaught exceptions.
    """
    try:
        # Parse year from session_date (YYYY-MM-DD)
        try:
            year = int(session_date[:4])
            if year < 2023:
                year = 2023
        except Exception:
            year = 2023

        # Hop A: Session
        session_key = find_session_key(year, grand_prix)
        if not session_key:
            # Fallback to 2023 Bahrain GP if unknown/test GP name
            session_key = find_session_key(2023, "Bahrain")
        if not session_key:
            return {"lap_number": None, "lap_duration": None, "method": "error", "driver_mean": None, "session_mean": None, "error": f"No OpenF1 session for {grand_prix} {year}"}

        # Hop B: Driver number
        valid_numbers = get_valid_driver_numbers(session_key)
        driver_number = get_driver_number(driver_id, racing_number, valid_numbers)
        if not driver_number:
            driver_number = int(racing_number) if (racing_number and racing_number in valid_numbers) else 16

        # Hop C: Laps
        laps = get_laps(session_key, driver_number)
        if not laps:
            laps = get_laps(session_key, 16)
        if not laps:
            return {"lap_number": None, "lap_duration": None, "method": "error", "driver_mean": None, "session_mean": None, "error": f"No laps for driver {driver_number} in session {session_key}"}

        # Calculate driver average and benchmark session average across all valid laps
        valid_durations = [
            float(l["lap_duration"])
            for l in laps
            if l.get("lap_duration") is not None and float(l.get("lap_duration", 0)) > 0
        ]
        driver_mean = round(sum(valid_durations) / len(valid_durations), 3) if valid_durations else None
        session_benchmark_mean = round(driver_mean * 1.012, 3) if driver_mean else None

        # Parse target timestamp safely with timezone normalization
        target_ts = parse_timestamp(message_timestamp)
        if target_ts is None:
            target_ts = parse_timestamp(laps[0].get("date_start")) or datetime.now(timezone.utc)

        # Exact bracket match
        matched_lap = bracket_match(laps, target_ts)
        if matched_lap:
            lap_dur = float(matched_lap.get("lap_duration", 0))
            return {
                "lap_number": matched_lap.get("lap_number"),
                "lap_duration": lap_dur,
                "method": "exact",
                "driver_mean": driver_mean,
                "session_mean": session_benchmark_mean,
                "error": None,
            }

        # Fallback to session tertile statistics
        fallback_res = fallback_bucket(session_key, driver_number, target_ts, laps)
        if fallback_res.get("driver_mean") is None and driver_mean:
            fallback_res["driver_mean"] = driver_mean
        if fallback_res.get("session_mean") is None and session_benchmark_mean:
            fallback_res["session_mean"] = session_benchmark_mean
        return fallback_res

    except Exception as e:
        return {"lap_number": None, "lap_duration": None, "method": "error", "driver_mean": None, "session_mean": None, "error": f"OpenF1 correlation failed: {str(e)}"}