import requests
from typing import Optional

OPENF1_BASE_URL = "https://api.openf1.org/v1"
OPENF1_TIMEOUT = 10  # seconds


def find_session_key(year: int, grand_prix: str) -> Optional[int]:
    """
    Queries /v1/sessions?year={year} and matches grand_prix to location/country_name/session_name.
    Returns session_key for Race session if multiple matches, else first match.
    """
    try:
        resp = requests.get(
            f"{OPENF1_BASE_URL}/sessions",
            params={"year": year},
            timeout=OPENF1_TIMEOUT,
        )
        data = resp.json()
        if not isinstance(data, list):
            return None
    except Exception:
        return None

    # Normalize search term: "2023 Bahrain Grand Prix" -> "Bahrain"
    search_term = grand_prix.lower().replace(str(year), "").replace("grand prix", "").strip()

    matches = [
        s for s in data
        if search_term in str(s.get("location", "")).lower()
        or search_term in str(s.get("country_name", "")).lower()
        or search_term in str(s.get("session_name", "")).lower()
    ]

    if not matches:
        return None

    # Prioritize Race session
    race_sessions = [s for s in matches if s.get("session_type") == "Race"]
    if race_sessions:
        return race_sessions[0]["session_key"]
    return matches[0]["session_key"]