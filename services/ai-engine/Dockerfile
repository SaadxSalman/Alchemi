# Alchemi AI Engine — Python FastAPI + PyTorch + RDKit
FROM python:3.13-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
# CPU-only torch keeps the image lean (~200MB instead of multi-GB CUDA wheels)
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install -r requirements.txt

FROM deps AS runtime
COPY . .
EXPOSE 8000
CMD ["python", "main.py"]