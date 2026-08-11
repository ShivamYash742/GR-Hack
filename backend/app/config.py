import os


def env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def running_on_render() -> bool:
    return env_flag("RENDER") or os.getenv("RENDER_SERVICE_ID") is not None


def demo_mode_enabled() -> bool:
    """
    Render free-tier instances do not have enough memory for the local ML
    models. Default Render deploys to demo mode unless explicitly overridden.
    """
    value = os.getenv("SILENT_CO_DRIVER_DEMO_MODE")
    if value is not None:
        return env_flag("SILENT_CO_DRIVER_DEMO_MODE")
    return running_on_render()
