from datetime import datetime
from typing import Optional
from .sessions import find_session_key
from .drivers import get_valid_driver_numbers
from .laps import get_laps, bracket_match, fallback_bucket
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
        year = int(session_date[:4])

        # Hop A: Session
        session_key = find_session_key(year, grand_prix)
        if not session_key:
            return {"lap_number": None, "lap_duration": None, "method": "error", "driver_mean": None, "session_mean": None, "error": f"No OpenF1 session for {grand_prix} {year}"}

        # Hop B: Driver number
        valid_numbers = get_valid_driver_numbers(session_key)
        driver_number = get_driver_number(driver_id, racing_number, valid_numbers)
        if not driver_number:
            return {"lap_number": None, "lap_duration": None, "method": "error", "driver_mean": None, "session_mean": None, "error": f"Driver {driver_id} not resolvable for session {session_key}"}

        # Hop C: Laps
        laps = get_laps(session_key, driver_number)
        if not laps:
            return {"lap_number": None, "lap_duration": None, "method": "error", "driver_mean": None, "session_mean": None, "error": f"No laps for driver {driver_number} in session {session_key}"}

        # Parse target timestamp
        target_ts = datetime.fromisoformat(message_timestamp.replace("Z", "+00:00"))

        # Exact bracket match
        matched_lap = bracket_match(laps, target_ts)
        if matched_lap:
            return {
                "lap_number": matched_lap.get("lap_number"),
                "lap_duration": float(matched_lap.get("lap_duration", 0)),
                "method": "exact",
                "driver_mean": None,
                "session_mean": None,
                "error": None,
            }

        # Fallback to session tertile statistics
        return fallback_bucket(session_key, driver_number, target_ts, laps)

    except Exception as e:
        return {"lap_number": None, "lap_duration": None, "method": "error", "driver_mean": None, "session_mean": None, "error": f"OpenF1 correlation failed: {str(e)}"}