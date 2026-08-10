# Static lookup dictionary — extend as new driver_ids appear in 2023+ data
DRIVER_ID_TO_NUMBER = {
    "MAXVER01": 1,   # Max Verstappen
    "LEWHAM01": 44,  # Lewis Hamilton
    "CHALEC01": 16,  # Charles Leclerc
    "LANNOR01": 4,   # Lando Norris
    "GEORUS01": 63,  # George Russell
    "CARSAI01": 55,  # Carlos Sainz
    "SERPER01": 11,  # Sergio Perez
    "VALBOT01": 77,  # Valtteri Bottas
    "ESTOCO01": 31,  # Esteban Ocon
    "PIAGAS01": 10,  # Pierre Gasly
    "FERALO01": 14,  # Fernando Alonso
    "LANSTR01": 18,  # Lance Stroll
    "YUKTSU01": 22,  # Yuki Tsunoda
    "ALBALO01": 23,  # Alexander Albon
    "KRAZHU01": 27,  # Nico Hulkenberg
    "KEVMAG01": 20,  # Kevin Magnussen
    "ZHOGUA01": 24,  # Zhou Guanyu
    "NYCVRI01": 21,  # Nyck de Vries
    "LIAMAW01": 40,  # Liam Lawson
    "LOGSAR01": 2,   # Logan Sargeant
}


def get_driver_number(driver_id: str | None, racing_number: int | None, valid_numbers: set[int] | None = None) -> int | None:
    """
    Priority:
    1. racing_number if provided AND present in OpenF1 valid_numbers for session
    2. driver_id lookup in static dict
    3. None if unresolvable
    """
    if racing_number is not None and valid_numbers is not None and racing_number in valid_numbers:
        return int(racing_number)
    if driver_id and driver_id in DRIVER_ID_TO_NUMBER:
        return DRIVER_ID_TO_NUMBER[driver_id]
    return None