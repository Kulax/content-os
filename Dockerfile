# syntax=docker/dockerfile:1

# ---------- Stage 1: build the studio frontend ----------
FROM node:24-alpine AS frontend

WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Same-origin API: the backend below serves this build, so no API URL is baked in.
RUN npm run build


# ---------- Stage 2: backend runtime (also serves the frontend) ----------
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    FFMPEG_BINARY=ffmpeg \
    FRONTEND_DIST=/app/frontend/dist

WORKDIR /app

# ffmpeg composes, narrates and captions videos.
# Fonts for burned-in captions: DejaVu for Latin scripts, Noto for Devanagari (Hindi) and CJK (Japanese).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core fonts-noto-core fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY --from=frontend /frontend/dist ./frontend/dist

# Run as an unprivileged user.
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/backend/uploads \
    && chown -R appuser /app/backend/uploads
USER appuser

EXPOSE 8080

# Cloud Run provides PORT; one process keeps the in-memory video job store consistent.
CMD ["sh", "-c", "exec uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers --forwarded-allow-ips='*'"]
