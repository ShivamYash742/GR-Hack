import requests
from typing import Set

OPENF1_BASE_URL = "https://api.openf1.org/v1"
OPENF1_TIMEOUT = 10  # seconds


def get_valid_driver_numbers(session_key: int) -> Set[int]:
    try:
        resp = requests.get(
            f"{OPENF1_BASE_URL}/drivers",
            params={"session_key": session_key},
            timeout=OPENF1_TIMEOUT,
        )
        data = resp.json()
        if not isinstance(data, list):
            return set()
        return {d.get("driver_number") for d in data if d.get("driver_number") is not None}
    except Exception:
        return set()