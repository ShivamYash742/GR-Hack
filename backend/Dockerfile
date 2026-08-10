# Render Dockerfile for the Silent Co-Driver backend.
#
# Notes:
# - We deliberately do NOT pre-download the HF models during the build
#   — Whisper-small + wav2vec2 together are ~2 GB. Instead we let the
#   FastAPI lifespan in `app/main.py` load them on first cold start, and
#   we cache via $HF_HOME on the disk that Render mounts at /opt/render.
# - First request after spin-up pays the model-load cost (~30–90 s on the
#   free tier). Per CLAUDE.md §Demo-day operational notes, warm the
#   service 5–10 min before presenting.
# - Slim base image keeps the final layer under ~600 MB before torch.

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/opt/render/.cache/huggingface \
    TRANSFORMERS_CACHE=/opt/render/.cache/huggingface

WORKDIR /opt/render/app

# Install OS deps needed by soundfile + librosa + triton-less torch.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first so changes to app source don't bust the cache.
COPY requirements-prod.txt .
RUN pip install -r requirements-prod.txt

# Now the app source.
COPY ./app ./app

EXPOSE 8000

# Render sets $PORT. uvicorn binds to all interfaces so the proxy works.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
