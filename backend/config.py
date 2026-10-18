import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_NAME: str = "CONTENT OS"
    APP_VERSION: str = "0.1.0"

    GOOGLE_CLOUD_PROJECT: str = os.getenv("GOOGLE_CLOUD_PROJECT", "")
    GOOGLE_CLOUD_LOCATION: str = os.getenv(
        "GOOGLE_CLOUD_LOCATION",
        "global",
    )

    GEMINI_MODEL: str = os.getenv(
        "GEMINI_MODEL",
        "gemini-2.5-flash",
    )

    VEO_MODEL: str = os.getenv(
        "VEO_MODEL",
        "veo-3.1-generate-001",
    )

    # Veo's own soundtrack is always replaced by the narration track, so don't pay to generate it.
    VEO_GENERATE_AUDIO: bool = os.getenv("VEO_GENERATE_AUDIO", "false").strip().lower() in ("1", "true", "yes")

    GENERATED_VIDEOS_BUCKET: str = os.getenv(
        "GENERATED_VIDEOS_BUCKET",
        "gs://ai-builder-cup-510507-content/generated-videos",
    )

    FFMPEG_BINARY: str = os.getenv(
        "FFMPEG_BINARY",
        "ffmpeg",
    )

    TTS_LANGUAGE_CODE: str = os.getenv(
        "TTS_LANGUAGE_CODE",
        "en-US",
    )

    TTS_VOICE_NAME: str = os.getenv(
        "TTS_VOICE_NAME",
        "en-US-Chirp3-HD-Achernar",
    )

    TTS_SPEAKING_RATE: float = float(
        os.getenv("TTS_SPEAKING_RATE", "1.0")
    )

    YOUTUBE_API_KEY: str = os.getenv(
        "YOUTUBE_API_KEY",
        "",
    )

    YOUTUBE_API_BASE: str = os.getenv(
        "YOUTUBE_API_BASE",
        "https://www.googleapis.com/youtube/v3",
    )

    # Public-deployment guards: cap Veo spend per video and how many renders run at once.
    MAX_VIDEO_SECONDS: int = int(os.getenv("MAX_VIDEO_SECONDS", "60"))
    MAX_CONCURRENT_VIDEO_JOBS: int = int(os.getenv("MAX_CONCURRENT_VIDEO_JOBS", "2"))

    # Comma-separated origins allowed to call the API from another site ("*" = any).
    CORS_ALLOW_ORIGINS: list[str] = [
        origin.strip() for origin in os.getenv("CORS_ALLOW_ORIGINS", "*").split(",") if origin.strip()
    ]

    # Built studio frontend served by the backend (single Cloud Run service). Skipped if missing.
    FRONTEND_DIST: str = os.getenv(
        "FRONTEND_DIST",
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist"),
    )


settings = Settings()


if not settings.GOOGLE_CLOUD_PROJECT:
    raise RuntimeError(
        "GOOGLE_CLOUD_PROJECT is not configured."
    )