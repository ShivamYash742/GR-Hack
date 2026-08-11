# Render Dockerfile for the Silent Co-Driver backend.
#
# Notes:
# - We deliberately do NOT pre-download the HF models during the build.
#   Whisper-small + wav2vec2 together are too heavy for free-tier Render.
# - The image defaults to SILENT_CO_DRIVER_DEMO_MODE=1 so /analyze stays
#   responsive on 512 MB instances. Set it to 0 only on a larger host.
# - Slim base image keeps the final layer under ~600 MB before torch.

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/tmp/huggingface \
    TRANSFORMERS_CACHE=/tmp/huggingface \
    SILENT_CO_DRIVER_DEMO_MODE=1

WORKDIR /opt/render/app

# Install OS deps needed by soundfile + librosa + triton-less torch.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements-prod.txt (works if build context is root or backend/)
COPY requirements-prod.txt* backend/requirements-prod.txt* ./
RUN if [ -f requirements-prod.txt ]; then pip install -r requirements-prod.txt; \
    elif [ -f backend/requirements-prod.txt ]; then pip install -r backend/requirements-prod.txt; fi

# Copy application source (works if context is root or backend/)
COPY . ./src_tmp/
RUN if [ -d ./src_tmp/app ]; then cp -r ./src_tmp/app ./app; \
    elif [ -d ./src_tmp/backend/app ]; then cp -r ./src_tmp/backend/app ./app; fi \
    && rm -rf ./src_tmp

EXPOSE 8000

# Render sets $PORT. uvicorn binds to all interfaces so the proxy works.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
