# import os

# from dotenv import load_dotenv
# from fastapi import FastAPI, HTTPException
# from pydantic import BaseModel, Field

# from google import genai
# from google.genai.types import GenerateContentConfig, HttpOptions

# from backend.models import ContentBlueprint
# from backend.prompts import BLUEPRINT_SYSTEM_PROMPT


# # ---------------------------------------------------------
# # Environment
# # ---------------------------------------------------------

# load_dotenv()

# PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
# LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "global")

# if not PROJECT_ID:
#     raise RuntimeError(
#         "GOOGLE_CLOUD_PROJECT is not configured."
#     )


# # ---------------------------------------------------------
# # Gemini client
# # ---------------------------------------------------------

# client = genai.Client(
#     vertexai=True,
#     project=PROJECT_ID,
#     location=LOCATION,
#     http_options=HttpOptions(api_version="v1"),
# )


# # ---------------------------------------------------------
# # FastAPI application
# # ---------------------------------------------------------

# app = FastAPI(
#     title="CONTENT OS",
#     description="AI Content Experience Engine",
#     version="0.1.0",
# )


# # ---------------------------------------------------------
# # Request model
# # ---------------------------------------------------------

# class CreateRequest(BaseModel):
#     prompt: str = Field(
#         min_length=5,
#         description="What the user wants to create."
#     )

#     audience_level: str = Field(
#         default="general",
#         description="Audience knowledge level."
#     )

#     duration_seconds: int = Field(
#         default=120,
#         ge=15,
#         le=1800,
#         description="Target content duration."
#     )

#     language: str = Field(
#         default="English"
#     )

#     format: str = Field(
#         default="video"
#     )

#     tone: str = Field(
#         default="engaging"
#     )


# # ---------------------------------------------------------
# # Basic routes
# # ---------------------------------------------------------

# @app.get("/")
# def root():
#     return {
#         "product": "CONTENT OS",
#         "version": "0.1.0",
#         "status": "running",
#     }


# @app.get("/health")
# def health():
#     return {
#         "status": "healthy",
#         "project": PROJECT_ID,
#     }


# # ---------------------------------------------------------
# # CREATE — Content Blueprint Engine
# # ---------------------------------------------------------

# @app.post(
#     "/api/create",
#     response_model=ContentBlueprint,
# )
# def create_content(request: CreateRequest):

#     user_prompt = f"""
# USER CREATION REQUEST:

# {request.prompt}


# CREATION PARAMETERS:

# Audience knowledge level:
# {request.audience_level}

# Target duration:
# {request.duration_seconds} seconds

# Language:
# {request.language}

# Format:
# {request.format}

# Tone:
# {request.tone}


# Design a complete Content Blueprint for this request.
# """

#     try:

#         response = client.models.generate_content(
#             model="gemini-2.5-flash",
#             contents=[
#                 BLUEPRINT_SYSTEM_PROMPT,
#                 user_prompt,
#             ],
#             config=GenerateContentConfig(
#                 temperature=0.7,
#                 response_mime_type="application/json",
#                 response_schema=ContentBlueprint,
#             ),
#         )

#         if not response.text:
#             raise HTTPException(
#                 status_code=500,
#                 detail="Gemini returned an empty response.",
#             )

#         return ContentBlueprint.model_validate_json(
#             response.text
#         )

#     except Exception as exc:

#         raise HTTPException(
#             status_code=500,
#             detail=f"Content generation failed: {str(exc)}",
#         )
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from typing import Any, Callable, List, Optional
from uuid import uuid4
import mimetypes
import re
import shutil
import threading
from google.genai.types import Image
from backend.services.jobs import VideoJobStore
from backend.services.video import VideoGenerationService
from backend.config import settings
from backend.models import (
    AdaptRequest,
    BlueprintVideoRequest,
    ContentUnderstanding,
    ContentBlueprint,
    ComposeSceneRequest,
    CreateRequest,
    GenerateNarrationRequest,
    LocalizeRequest,
    NarrationVoice,
    RefinePromptRequest,
    RenderExperienceRequest,
    RevoiceRequest,
    TrendSignal,
    TrendIdeationRequest,
    TrendIdeationResponse,
    TransformRequest,
    YouTubeTrendIdeationRequest,
    YouTubeTrendIdeationResponse,
    UnderstandRequest,
)

from backend.services.blueprint import BlueprintService, new_content_id
from backend.services.captions import build_caption_cues
from backend.services.composer import CompositionService
from backend.services.content_store import ContentStore, is_valid_content_id
from backend.services.narration import (
    NarrationService,
    infer_voice_gender,
    known_language_code,
    normalize_voice_gender,
    resolve_language_code,
)
from backend.services.localization import LocalizationService
from backend.services.prompt_refiner import PromptRefinerService
from backend.services.planner import ExperiencePlannerService
from backend.services.styles import resolve_style_profile
from backend.services.trend_ideation import TrendIdeationService
from backend.services.understanding import UnderstandingService
from backend.services.youtube_trends import YouTubeTrendsService
from backend.utils.validation import are_valid_subtitle_cues, is_valid_gs_uri


app = FastAPI(
    title=settings.APP_NAME,
    description="AI Content Experience Engine",
    version=settings.APP_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    # The studio sends no cookies; credentials with a "*" origin are rejected by browsers anyway.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


blueprint_service = BlueprintService()
video_service = VideoGenerationService()
planner_service = ExperiencePlannerService()
composition_service = CompositionService()
narration_service = NarrationService()
understanding_service = UnderstandingService()
trend_ideation_service = TrendIdeationService()
youtube_trends_service = YouTubeTrendsService()
video_jobs = VideoJobStore()
# Limits simultaneous renders (Veo quota, CPU/memory); extra jobs wait in the queue.
video_render_slots = threading.BoundedSemaphore(max(settings.MAX_CONCURRENT_VIDEO_JOBS, 1))
localization_service = LocalizationService()
prompt_refiner_service = PromptRefinerService()
content_store = ContentStore(composition_service.storage_client, settings.GENERATED_VIDEOS_BUCKET)

ALLOWED_PERSONA_IMAGE_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}
MAX_PERSONA_IMAGE_BYTES = 10 * 1024 * 1024
MEDIA_RANGE_CHUNK_BYTES = 4 * 1024 * 1024


def _plan_blueprint_shots(blueprint: ContentBlueprint) -> ContentBlueprint:
    for scene in blueprint.scenes:
        scene.shots = planner_service.plan_scene(scene)
    return blueprint


def _persist_blueprint(blueprint: ContentBlueprint) -> None:
    # Saving is best-effort: a storage hiccup must not throw away a finished generation.
    try:
        content_store.save_blueprint(blueprint)
    except Exception as exc:
        print(f"WARNING: could not save Content DNA {blueprint.content_id} v{blueprint.version}: {exc}")


def _persist_video_result(content_id: str, version: int, result: dict) -> None:
    try:
        content_store.save_video_result(content_id, version, result)
    except Exception as exc:
        print(f"WARNING: could not save video result {content_id} v{version}: {exc}")


def _require_content_id(content_id: str) -> str:
    content_id = (content_id or "").strip()
    if not is_valid_content_id(content_id):
        raise HTTPException(
            status_code=422,
            detail="Invalid content ID. Use letters, numbers, '-', '_' or '.' (no slashes).",
        )
    return content_id


def _synthesize_video_result(content_id: str, version: int, assets) -> Optional[dict]:
    """Build a preview-compatible video result from files for versions rendered before video.json existed."""
    if not assets.final_video_uri and not assets.scene_videos:
        return None
    scenes = [
        {
            "scene_number": number,
            "scene_title": f"Scene {number}",
            "duration_seconds": 0,
            "shot_plan": [],
            "shot_assets": [],
            "preview_video_path": uri,
            "captioned_scene_video_path": uri if "/captioned_" in uri else None,
            "caption_status": "completed" if "/captioned_" in uri else "not_requested",
        }
        for number, uri in sorted(assets.scene_videos.items())
    ]
    return {
        "content_id": content_id,
        "version": version,
        "total_scenes": len(scenes),
        "final_video_uri": assets.final_video_uri,
        "render_status": "completed" if assets.final_video_uri else "incomplete",
        "render_message": "" if assets.final_video_uri else "This version has no stitched final video.",
        "scenes": scenes,
        "scene_number": scenes[0]["scene_number"] if scenes else 1,
        "scene_title": scenes[0]["scene_title"] if scenes else "",
        "shot_plan": [],
        "shot_assets": [],
        "scene_video_path": None,
        "composition_status": "completed",
        "composition_message": "",
        "narration_audio_uri": None,
        "narration_status": "completed",
        "narration_message": "",
        "narrated_scene_video_path": None,
        "narrated_scene_status": "completed",
        "narrated_scene_message": "",
        "status": "completed",
    }


def _load_content(content_id: str, version: Optional[int] = None) -> dict:
    """Load a saved Content DNA version, rebuilding it from the rendered video if it was never saved."""
    versions = content_store.scan(content_id)
    if not versions:
        raise HTTPException(
            status_code=404,
            detail=f"Content ID '{content_id}' was not found in {settings.GENERATED_VIDEOS_BUCKET}.",
        )

    if version is not None:
        if version not in versions:
            raise HTTPException(status_code=404, detail=f"Version v{version} of '{content_id}' was not found.")
        selected = version
    else:
        # Prefer the newest version that has a saved plan or a finished video; partial renders are skipped.
        usable = [v for v, a in versions.items() if a.has_blueprint or a.final_video_uri]
        selected = max(usable) if usable else max(versions)

    assets = versions[selected]
    recovered = False
    blueprint = content_store.load_blueprint(content_id, selected) if assets.has_blueprint else None

    if blueprint is None:
        scene_videos = sorted(assets.scene_videos.items())
        if not scene_videos:
            raise HTTPException(
                status_code=422,
                detail=f"'{content_id}' v{selected} has no saved Content DNA and no scene videos to rebuild it from.",
            )
        blueprint = blueprint_service.reconstruct_from_scene_videos(content_id, selected, scene_videos)
        _plan_blueprint_shots(blueprint)
        _persist_blueprint(blueprint)
        recovered = True

    video_result = content_store.load_video_result(content_id, selected) if assets.has_video_result else None
    if video_result is None:
        video_result = _synthesize_video_result(content_id, selected, assets)

    return {
        "content_id": content_id,
        "version": selected,
        "versions": sorted(versions),
        "latest_version": max(versions),
        "recovered": recovered,
        "blueprint": blueprint,
        "video_result": video_result,
    }


def _latest_known_version(content_id: str) -> int:
    try:
        versions = content_store.scan(content_id)
    except Exception:
        return 0
    return max(versions) if versions else 0


def _split_gs_uri(gs_uri: str) -> tuple[str, str]:
    without_scheme = gs_uri[len("gs://"):]
    bucket_name, _, blob_name = without_scheme.partition("/")
    return bucket_name, blob_name


def _resolve_persona_reference_image(reference_uri: Optional[str]) -> Optional[Image]:
    """Turn the persona photo reference (gs:// URI or /uploads path) into a Veo image input."""
    if not reference_uri:
        return None

    clean_uri = reference_uri.split("?", 1)[0]
    mime_type = mimetypes.guess_type(clean_uri)[0] or "image/jpeg"
    if mime_type not in ALLOWED_PERSONA_IMAGE_TYPES:
        raise ValueError(f"Unsupported persona photo type: {mime_type}. Use PNG, JPEG or WebP.")

    if is_valid_gs_uri(clean_uri):
        return Image(gcs_uri=clean_uri, mime_type=mime_type)

    local_path = UPLOAD_DIR / Path(clean_uri).name
    if local_path.is_file():
        return Image(image_bytes=local_path.read_bytes(), mime_type=mime_type)

    raise ValueError("Persona reference photo not found. Upload the photo again.")


@app.get("/api/info")
def info():
    return {
        "product": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "project": settings.GOOGLE_CLOUD_PROJECT,
        "max_video_seconds": settings.MAX_VIDEO_SECONDS,
    }


@app.post("/api/upload-persona-photo")
def upload_persona_photo(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    content_type = (file.content_type or mimetypes.guess_type(file.filename)[0] or "").lower()
    if content_type not in ALLOWED_PERSONA_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Persona photo must be a PNG, JPEG or WebP image.")

    data = file.file.read(MAX_PERSONA_IMAGE_BYTES + 1)
    if len(data) > MAX_PERSONA_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Persona photo must be 10 MB or smaller.")
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded photo is empty.")

    try:
        file_id = f"persona_{uuid4().hex[:10]}{ALLOWED_PERSONA_IMAGE_TYPES[content_type]}"
        destination = UPLOAD_DIR / file_id
        destination.write_bytes(data)

        # Veo reads reference images from Cloud Storage; the local copy serves the UI preview.
        gcs_uri = f"{settings.GENERATED_VIDEOS_BUCKET}/personas/{file_id}"
        composition_service.upload_file(destination, gcs_uri, content_type=content_type)

        return {
            "status": "uploaded",
            "file_id": file_id,
            "filename": file.filename,
            "url": f"/uploads/{file_id}",
            "gcs_uri": gcs_uri,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(exc)}")


@app.get("/api/media")
def stream_media(uri: str, request: Request):
    """Stream generated media from the private bucket so the browser can preview it."""
    if not is_valid_gs_uri(uri):
        raise HTTPException(status_code=422, detail="Only gs:// URIs are supported.")

    allowed_prefix = settings.GENERATED_VIDEOS_BUCKET.rstrip("/") + "/"
    if not uri.startswith(allowed_prefix) or ".." in uri:
        raise HTTPException(status_code=403, detail="Media is only served from the configured output bucket.")

    bucket_name, blob_name = _split_gs_uri(uri)
    blob = composition_service.storage_client.bucket(bucket_name).get_blob(blob_name)
    if blob is None:
        raise HTTPException(status_code=404, detail="Media not found.")

    size = blob.size or 0
    media_type = blob.content_type or mimetypes.guess_type(blob_name)[0] or "application/octet-stream"
    range_header = request.headers.get("range")

    if range_header:
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
        if not match or (not match.group(1) and not match.group(2)):
            raise HTTPException(status_code=416, detail="Invalid Range header.")

        if match.group(1):
            start = int(match.group(1))
            end = int(match.group(2)) if match.group(2) else start + MEDIA_RANGE_CHUNK_BYTES - 1
        else:
            start = max(size - int(match.group(2)), 0)
            end = size - 1
        end = min(end, size - 1)

        if start >= size or start > end:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})

        data = blob.download_as_bytes(start=start, end=end)
        return Response(
            content=data,
            status_code=206,
            media_type=media_type,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Range": f"bytes {start}-{end}/{size}",
                "Content-Length": str(len(data)),
                "Cache-Control": "private, max-age=3600",
            },
        )

    def iter_blob():
        with blob.open("rb", chunk_size=MEDIA_RANGE_CHUNK_BYTES) as reader:
            while chunk := reader.read(MEDIA_RANGE_CHUNK_BYTES):
                yield chunk

    return StreamingResponse(
        iter_blob(),
        media_type=media_type,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(size),
            "Cache-Control": "private, max-age=3600",
        },
    )


@app.post("/api/create", response_model=ContentBlueprint)
def create_content(request: CreateRequest):
    try:
        blueprint = _plan_blueprint_shots(blueprint_service.generate(request))
        _persist_blueprint(blueprint)
        return blueprint

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Content generation failed: {str(exc)}",
        )


@app.post("/api/transform", response_model=ContentBlueprint)
def transform_content(request: TransformRequest):
    try:
        user_prompt = f"""
SOURCE CONTENT:
{request.source_text}

TRANSFORMATION GOAL:
{request.transform_goal}

TARGET PARAMETERS:
Audience knowledge level:
{request.audience_level}

Target duration:
{request.duration_seconds} seconds

Language:
{request.language}

Format:
{request.format}

Tone:
{request.tone}

Transform this source into a coherent Content Blueprint experience.
"""

        blueprint = _plan_blueprint_shots(blueprint_service.generate_from_prompt(user_prompt))
        _persist_blueprint(blueprint)
        return blueprint

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Transformation failed: {str(exc)}",
        )


@app.post("/api/adapt", response_model=ContentBlueprint)
def adapt_content(request: AdaptRequest):
    try:
        blueprint = _adapt_blueprint(request)
        _persist_blueprint(blueprint)
        return blueprint

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Adaptation failed: {str(exc)}",
        )


@app.get("/api/content")
def list_content():
    """Content IDs that exist in the output bucket."""
    return content_store.list_content()


@app.post("/api/refine-prompt")
def refine_prompt(request: RefinePromptRequest):
    """Rewrite a rough user input (character look, brief, goal, instruction) into a stronger prompt."""
    context = {key: str(value)[:500] for key, value in list(request.context.items())[:20]}
    try:
        result = prompt_refiner_service.refine(request.field, request.text, context)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prompt refinement failed: {str(exc)}")
    return {"field": request.field, "original": request.text, "refined": result.refined, "notes": result.notes}


@app.get("/api/content/{content_id}")
def get_content(content_id: str, version: Optional[int] = None):
    """Load a Content DNA version (latest by default) plus its rendered video, for adapting or previewing."""
    content_id = _require_content_id(content_id)
    try:
        return _load_content(content_id, version)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not load content '{content_id}': {str(exc)}")


def _resolve_adapt_base(request: AdaptRequest) -> Optional[ContentBlueprint]:
    """The version to evolve: the supplied DNA if it matches the content ID, otherwise the saved one."""
    content_id = (request.content_id or "").strip() or None
    base = request.base_blueprint

    if content_id is None:
        return base

    content_id = _require_content_id(content_id)
    if base is not None and base.content_id == content_id:
        return base

    return _load_content(content_id)["blueprint"]


def _adapt_blueprint(request: AdaptRequest) -> ContentBlueprint:
    base_request = request.base_request
    base_blueprint = _resolve_adapt_base(request)

    if base_blueprint:
        # Shots are re-planned by the backend, so they add noise without informing the adaptation.
        base_json = base_blueprint.model_dump_json(
            exclude={"scenes": {"__all__": {"shots"}}},
        )
        base_section = f"""
BASE CONTENT:
{base_blueprint.title}: {base_blueprint.one_line_concept}

BASE PARAMETERS (keep unless the adaptation instruction changes them):
Audience knowledge level:
{base_blueprint.audience.knowledge_level}

Target duration:
{base_blueprint.target_duration_seconds} seconds

Language:
{base_blueprint.language}

Format:
{base_blueprint.format}

Tone:
{base_blueprint.tone}

CURRENT CONTENT DNA (version {base_blueprint.version}) - evolve this version:
{base_json}

Keep everything that the adaptation instruction does not ask to change
(core message, structure, recurring characters/objects and visual continuity).
"""
    else:
        base_section = f"""
BASE CREATION REQUEST:
{base_request.prompt}

BASE PARAMETERS:
Audience knowledge level:
{base_request.audience_level}

Target duration:
{base_request.duration_seconds} seconds

Language:
{base_request.language}

Format:
{base_request.format}

Tone:
{base_request.tone}
"""

    user_prompt = f"""
{base_section}
ADAPTATION INSTRUCTION:
{request.adaptation_instruction}

Apply adaptation while preserving the core knowledge intent.
Design the adapted Content Blueprint.
"""

    blueprint = blueprint_service.generate_from_prompt(user_prompt)

    content_id = (request.content_id or "").strip() or (base_blueprint.content_id if base_blueprint else None)
    if content_id:
        blueprint.content_id = content_id

    # Never reuse a version number that already has files, so earlier versions stay intact.
    current_version = max(
        request.current_version,
        base_blueprint.version if base_blueprint else 0,
        _latest_known_version(blueprint.content_id),
    )
    blueprint.version = current_version + 1

    return _plan_blueprint_shots(blueprint)


@app.post("/api/understand", response_model=ContentUnderstanding)
def understand_content(request: UnderstandRequest):
    try:
        return understanding_service.analyze(request)

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Understanding failed: {str(exc)}",
        )


@app.post("/api/ideate-trends", response_model=TrendIdeationResponse)
def ideate_trends(request: TrendIdeationRequest):
    try:
        return trend_ideation_service.ideate(request)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Trend ideation failed: {str(exc)}",
        )


@app.post("/api/ideate-youtube-trends", response_model=YouTubeTrendIdeationResponse)
def ideate_youtube_trends(request: YouTubeTrendIdeationRequest):
    try:
        resolved_category, resolved_category_id = youtube_trends_service.resolve_category(
            category=request.category,
            category_id=request.category_id,
        )

        videos, source_note = youtube_trends_service.fetch_trending(
            category_id=resolved_category_id,
            region_code=request.region_code.upper(),
            max_results=request.max_results,
            topic=request.topic_override,
            language=request.language,
        )

        signals = []
        for video in videos:
            signals.append(
                TrendSignal(
                    source_type="youtube_title",
                    source_label=video.get("channel_title") or "YouTube channel",
                    source_url=video.get("video_url"),
                    text=video.get("title") or "",
                )
            )

            engagement_snapshot = (
                f"Views: {video.get('view_count')}, "
                f"Likes: {video.get('like_count')}, "
                f"Comments: {video.get('comment_count')}"
            )

            signals.append(
                TrendSignal(
                    source_type="youtube_video_notes",
                    source_label=(video.get("channel_title") or "YouTube channel") + " engagement",
                    source_url=video.get("video_url"),
                    text=engagement_snapshot,
                )
            )

        ideation = trend_ideation_service.ideate(
            TrendIdeationRequest(
                topic=request.topic_override or f"YouTube trends in {resolved_category}",
                audience_level=request.audience_level,
                language=request.language,
                max_ideas=request.max_ideas,
                signals=signals,
                mcp_dump=None,
                additional_context=request.additional_context,
            )
        )

        return YouTubeTrendIdeationResponse(
            resolved_category=resolved_category,
            resolved_category_id=resolved_category_id,
            region_code=request.region_code.upper(),
            fetched_count=len(videos),
            source_note=source_note,
            trending_videos=videos,
            ideation=ideation,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"YouTube trend ideation failed: {str(exc)}",
        )

ProgressCallback = Callable[..., None]

NARRATION_FIT_TOLERANCE_SECONDS = 0.3
MAX_FIT_SPEAKING_RATE = 1.35


def _scene_footage_seconds(scene, prior_scene: Optional[dict] = None) -> Optional[float]:
    """Length of a scene's rendered footage: the shots actually generated, else the planned shots."""
    shot_plan = (prior_scene or {}).get("shot_plan") or []
    total = sum(shot.get("duration_seconds") or 0 for shot in shot_plan)
    if not total:
        total = sum(shot.duration_seconds for shot in scene.shots)
    return float(total) if total else None


def _localization_targets(languages: List[str], primary_language: Optional[str]) -> List[tuple[str, Optional[str]]]:
    """(language, language code) pairs to localize into: deduplicated, primary language excluded.

    Unknown languages are kept with a None code so they can be reported instead of silently dropped.
    """
    primary_code = resolve_language_code(primary_language or settings.TTS_LANGUAGE_CODE)
    targets: List[tuple[str, Optional[str]]] = []
    seen = {primary_code}
    for language in languages or []:
        language = (language or "").strip()
        if not language:
            continue
        code = known_language_code(language)
        if code is None:
            targets.append((language, None))
            continue
        if code in seen:
            continue
        seen.add(code)
        targets.append((language, code))
    return targets


def _render_localization(
    blueprint: ContentBlueprint,
    version_asset_key: str,
    language: str,
    language_code: str,
    title: str,
    translated: dict,
    composed: dict,
    footage: dict,
    voice_gender: Optional[str],
    speaking_rate: float,
    captions_enabled: bool,
    progress: ProgressCallback,
) -> dict:
    """Dub the existing footage with already-translated narration and stitch a localized final video."""
    asset_key = f"{version_asset_key}/{language_code}"
    scenes_output = []
    scene_video_uris = []
    for scene in blueprint.scenes:
        progress(
            "stage",
            stage="localizing",
            message=f"Localizing to {language}: scene {scene.scene_number}/{len(blueprint.scenes)}...",
        )
        localized_scene = scene.model_copy(update={"narration": translated[scene.scene_number]})
        narration_out = _narrate_scene(
            asset_key=asset_key,
            scene=localized_scene,
            scene_video_path=composed.get(scene.scene_number),
            language=language_code,
            voice_gender=voice_gender,
            speaking_rate=speaking_rate,
            captions_enabled=captions_enabled,
            footage_seconds=footage.get(scene.scene_number),
        )
        if narration_out["preview_video_path"] and narration_out["narrated_scene_video_path"]:
            scene_video_uris.append(narration_out["preview_video_path"])
        scenes_output.append({
            "scene_number": scene.scene_number,
            "scene_title": scene.title,
            "duration_seconds": scene.duration_seconds,
            "narration": localized_scene.narration,
            "scene_video_path": composed.get(scene.scene_number),
            **narration_out,
        })

    if len(scene_video_uris) == len(blueprint.scenes):
        final_video_uri, render_status, render_message = _stitch_scenes(asset_key, scene_video_uris)
    else:
        final_video_uri, render_status, render_message = None, "failed", "Some scenes could not be narrated in this language."

    return {
        "language": language,
        "language_code": language_code,
        "title": title,
        "final_video_uri": final_video_uri,
        "render_status": render_status,
        "render_message": render_message,
        "status": "completed" if final_video_uri else "failed",
        "error": None if final_video_uri else render_message,
        "scenes": scenes_output,
    }


def _localize_version(
    blueprint: ContentBlueprint,
    version_asset_key: str,
    targets: List[tuple[str, Optional[str]]],
    composed: dict,
    footage: dict,
    voice_gender: Optional[str],
    speaking_rate: float,
    captions_enabled: bool,
    progress: ProgressCallback,
) -> List[dict]:
    """Translate the narration into each target language and dub the existing footage (no new Veo shots)."""
    localizations = []
    for language, language_code in targets:
        if language_code is None:
            entry = {"language": language, "language_code": None, "status": "failed",
                     "error": f"Unsupported language '{language}'.", "final_video_uri": None, "scenes": []}
        else:
            try:
                progress("stage", stage="localizing", message=f"Translating narration into {language} with Gemini...")
                script = localization_service.translate_narration(blueprint, language)
                translated = {scene.scene_number: scene.narration.strip() for scene in script.scenes}
                entry = _render_localization(
                    blueprint, version_asset_key, language, language_code, script.title, translated,
                    composed, footage, voice_gender, speaking_rate, captions_enabled, progress,
                )
            except Exception as exc:
                entry = {"language": language, "language_code": language_code, "status": "failed",
                         "error": str(exc), "final_video_uri": None, "scenes": []}
        localizations.append(entry)
        progress("localization", localization=entry)
    return localizations


def _resolve_narration_voice(blueprint: ContentBlueprint, persona=None) -> tuple[Optional[str], float]:
    """Narrator gender and pace from the plan; falls back to free-text voice notes for older plans."""
    voice = blueprint.narration_voice
    gender = normalize_voice_gender(voice.gender) if voice else None
    if gender is None:
        plan_persona = blueprint.creator_persona
        anchor = blueprint.visual_continuity_anchor
        gender = infer_voice_gender(
            voice.delivery if voice else None,
            blueprint.narration_style,
            plan_persona.voice_tone if plan_persona else None,
            persona.voice_tone if persona else None,
            plan_persona.visual_description if plan_persona else None,
            anchor.character_dna if anchor else None,
        )

    rate = voice.speaking_rate if voice and voice.speaking_rate else settings.TTS_SPEAKING_RATE
    return gender, min(max(rate, 0.75), 1.25)


def _narrate_scene(
    asset_key: str,
    scene,
    scene_video_path: Optional[str],
    language: Optional[str],
    voice_gender: Optional[str],
    speaking_rate: float,
    captions_enabled: bool,
    footage_seconds: Optional[float] = None,
) -> dict:
    """Synthesize narration for a composed scene, mux it in and burn captions."""
    narration_audio_uri = None
    narration_duration = None
    narration_voice_name = None
    narration_status = "not_attempted"
    narration_message = ""

    def synthesize(rate: float):
        return narration_service.generate_audio_with_duration(
            content_id=asset_key,
            text=scene.narration,
            language_code=language or settings.TTS_LANGUAGE_CODE,
            speaking_rate=rate,
            scene_number=scene.scene_number,
            voice_gender=voice_gender,
        )

    try:
        narration_audio_uri, narration_duration, narration_voice_name = synthesize(speaking_rate)
        # Narration longer than the footage would be cut off; speak faster (within limits) to fit.
        if footage_seconds and narration_duration and narration_duration > footage_seconds + NARRATION_FIT_TOLERANCE_SECONDS:
            faster = min(speaking_rate * narration_duration / footage_seconds * 1.03, MAX_FIT_SPEAKING_RATE)
            if faster > speaking_rate + 0.01:
                narration_audio_uri, narration_duration, narration_voice_name = synthesize(faster)
                if narration_duration and narration_duration > footage_seconds + NARRATION_FIT_TOLERANCE_SECONDS:
                    narration_message = (
                        f"Narration ({narration_duration:.1f}s) is longer than the scene footage "
                        f"({footage_seconds:.1f}s); the end is cut off."
                    )
        narration_status = "completed"
    except Exception as narration_exc:
        narration_status = "failed"
        narration_message = str(narration_exc)

    # Merge scene video + scene narration audio
    narrated_scene_video_path = None
    narrated_scene_status = "not_attempted"
    narrated_scene_message = ""

    if scene_video_path and narration_audio_uri:
        try:
            narrated_scene_video_path = composition_service.merge_narration_audio(
                content_id=asset_key,
                video_uri=scene_video_path,
                audio_uri=narration_audio_uri,
            )

            if narrated_scene_video_path:
                narrated_scene_status = "completed"
            else:
                narrated_scene_status = "skipped"
                narrated_scene_message = "FFmpeg unavailable for narration merge."
        except Exception as merge_exc:
            narrated_scene_status = "failed"
            narrated_scene_message = str(merge_exc)
    elif scene_video_path and not narration_audio_uri:
        narrated_scene_status = "skipped"
        narrated_scene_message = "Narration audio unavailable."

    # Burn narration captions into the narrated scene
    captioned_scene_video_path = None
    caption_status = "not_requested" if not captions_enabled else "not_attempted"
    caption_message = ""

    if captions_enabled:
        if not narrated_scene_video_path:
            caption_status = "skipped"
            caption_message = "Captions need a narrated scene video."
        else:
            cues = build_caption_cues(scene.narration, narration_duration or scene.duration_seconds)
            if not cues:
                caption_status = "skipped"
                caption_message = "Scene has no narration text to caption."
            else:
                try:
                    captioned_scene_video_path = composition_service.burn_captions(
                        content_id=asset_key,
                        video_uri=narrated_scene_video_path,
                        cues=cues,
                        scene_number=scene.scene_number,
                    )
                    if captioned_scene_video_path:
                        caption_status = "completed"
                    else:
                        caption_status = "skipped"
                        caption_message = "FFmpeg unavailable for caption burn-in."
                except Exception as caption_exc:
                    caption_status = "failed"
                    caption_message = str(caption_exc)

    return {
        "narration_audio_uri": narration_audio_uri,
        "narration_voice_name": narration_voice_name,
        "narration_status": narration_status,
        "narration_message": narration_message,
        "narrated_scene_video_path": narrated_scene_video_path,
        "narrated_scene_status": narrated_scene_status,
        "narrated_scene_message": narrated_scene_message,
        "captioned_scene_video_path": captioned_scene_video_path,
        "caption_status": caption_status,
        "caption_message": caption_message,
        "preview_video_path": captioned_scene_video_path or narrated_scene_video_path or scene_video_path,
    }


def _stitch_scenes(asset_key: str, scene_video_uris: List[str]) -> tuple[Optional[str], str, str]:
    if not scene_video_uris:
        return None, "skipped", "No composed scenes available to stitch (individual Veo shots generated)."
    try:
        final_video_uri = composition_service.compose_experience(content_id=asset_key, scene_uris=scene_video_uris)
    except Exception as render_exc:
        return None, "failed", str(render_exc)
    if not final_video_uri:
        return None, "skipped", "FFmpeg required to stitch multiple scenes into a single final video."
    return final_video_uri, "completed", f"Successfully composed all {len(scene_video_uris)} scenes into final master video."


def _build_video_result(
    blueprint: ContentBlueprint,
    scenes_output: List[dict],
    shot_assets: List[dict],
    final_video_uri: Optional[str],
    render_status: str,
    render_message: str,
    face_reference_used: bool,
    localizations: Optional[List[dict]] = None,
) -> dict:
    # Scene 1 fields are repeated at the top level for older single-scene readers.
    first_scene = scenes_output[0] if scenes_output else {}
    return {
        "content_id": blueprint.content_id,
        "version": blueprint.version,
        "total_scenes": len(blueprint.scenes),
        "final_video_uri": final_video_uri,
        "render_status": render_status,
        "render_message": render_message,
        "scenes": scenes_output,
        "localizations": localizations or [],
        "scene_number": first_scene.get("scene_number", 1),
        "scene_title": first_scene.get("scene_title", ""),
        "shot_plan": first_scene.get("shot_plan", []),
        "shot_assets": shot_assets,
        "scene_video_path": first_scene.get("scene_video_path"),
        "composition_status": first_scene.get("composition_status", "not_attempted"),
        "composition_message": first_scene.get("composition_message", ""),
        "narration_audio_uri": first_scene.get("narration_audio_uri"),
        "narration_voice_name": first_scene.get("narration_voice_name"),
        "narration_status": first_scene.get("narration_status", "not_attempted"),
        "narration_message": first_scene.get("narration_message", ""),
        "narrated_scene_video_path": first_scene.get("narrated_scene_video_path"),
        "narrated_scene_status": first_scene.get("narrated_scene_status", "not_attempted"),
        "narrated_scene_message": first_scene.get("narrated_scene_message", ""),
        "captioned_scene_video_path": first_scene.get("captioned_scene_video_path"),
        "caption_status": first_scene.get("caption_status", "not_attempted"),
        "caption_message": first_scene.get("caption_message", ""),
        "face_reference_used": face_reference_used,
        "blueprint": blueprint.model_dump(),
        "status": "completed",
    }


def _run_create_video(
    request: CreateRequest,
    progress: Optional[ProgressCallback] = None,
    blueprint: Optional[ContentBlueprint] = None,
) -> dict:
    """Render a video. Generates a new blueprint unless an existing version is supplied."""
    report: ProgressCallback = progress or (lambda event, **data: None)

    try:
        # Resolve the creator's face photo once; Veo uses it as a subject reference image.
        persona = request.creator_persona
        reference_image = None
        if persona and persona.reference_image_uri and persona.presentation_mode != "b_roll_focused":
            reference_image = _resolve_persona_reference_image(persona.reference_image_uri)
        allowed_durations = planner_service.REFERENCE_IMAGE_DURATIONS if reference_image else None

        # Step 1: Create the Content DNA Blueprint (or render the supplied version as-is).
        if blueprint is None:
            report("stage", stage="blueprint", message="Writing the Content DNA blueprint with Gemini...")
            if request.duration_seconds > settings.MAX_VIDEO_SECONDS:
                request = request.model_copy(update={"duration_seconds": settings.MAX_VIDEO_SECONDS})
            blueprint = blueprint_service.generate(request)
        else:
            blueprint = blueprint.model_copy(deep=True)
            if not blueprint.content_id:
                blueprint.content_id = new_content_id(blueprint.title)

        # Each version renders into its own folder so earlier versions stay intact.
        asset_key = f"{blueprint.content_id}/v{blueprint.version}"

        # Plan shots for all scenes using strict Veo-compatible decomposition
        for sc in blueprint.scenes:
            sc.shots = planner_service.plan_scene(sc, allowed_durations)

        # Spend guard: refuse plans far beyond the deployment's video length limit (one shot of slack).
        planned_seconds = sum(shot.duration_seconds for sc in blueprint.scenes for shot in sc.shots)
        if planned_seconds > settings.MAX_VIDEO_SECONDS + 8:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"This plan needs about {planned_seconds}s of video, but this deployment allows up to "
                    f"{settings.MAX_VIDEO_SECONDS}s. Shorten it (for example adapt with "
                    f"'reduce to {settings.MAX_VIDEO_SECONDS} seconds') and try again."
                ),
            )

        # Save the plan before rendering so an interrupted render can still be adapted later.
        _persist_blueprint(blueprint)

        voice_gender, speaking_rate = _resolve_narration_voice(blueprint, persona)

        total_shots = sum(len(sc.shots) for sc in blueprint.scenes)
        report(
            "blueprint",
            content_id=blueprint.content_id,
            version=blueprint.version,
            title=blueprint.title,
            total_scenes=len(blueprint.scenes),
            total_shots=total_shots,
            face_reference_used=reference_image is not None,
        )

        scenes_output = []
        scene_video_uris = []
        overall_shot_assets = []
        shots_started = 0

        # Step 2: Loop through ALL scenes in the blueprint to generate the complete video experience
        continuity_anchor = blueprint.visual_continuity_anchor
        for scene_idx, scene in enumerate(blueprint.scenes):
            planned_shots = scene.shots

            persona_context = ""
            if persona:
                persona_context = f"""
CREATOR DIGITAL TWIN / HOST CONTEXT:
- Creator Name: {persona.name}
- Role / Style: {persona.role_title}
- Visual Anchor: {persona.visual_description}
- Presentation Mode: {persona.presentation_mode}
Anchor the on-camera subject appearance, lighting, and framing consistently to this creator profile.
"""
                if reference_image:
                    persona_context += """
IDENTITY LOCK (REFERENCE PHOTO):
The on-camera host is the exact person shown in the provided reference image.
Reproduce their face, facial features, skin tone, hair and apparent age faithfully in every frame.
If any written appearance description conflicts with the reference image, follow the reference image.
"""

            scene_shot_assets = []
            style_info = resolve_style_profile(blueprint.visual_style or request.visual_style)
            for shot in planned_shots:
                shot_action_beat = shot.visual_action or shot.purpose
                shot_type_label = getattr(shot, "shot_type", "A-Roll")

                # Build Universal Continuity Directives
                continuity_blocks = []
                if continuity_anchor:
                    if "A-Roll" in shot_type_label or "Host" in shot_type_label:
                        if continuity_anchor.character_dna:
                            continuity_blocks.append(
                                f"PRIMARY CHARACTER LOCK (Must match previous and future shots exactly):\n{continuity_anchor.character_dna}"
                            )
                    else:
                        continuity_blocks.append(
                            "B-ROLL SUBJECT PURITY RULE: Do not generate random unfamiliar humans or generic faces. "
                            "Focus strictly on the concept, environment, or key physical objects."
                        )

                    if continuity_anchor.environment_dna:
                        continuity_blocks.append(
                            f"ENVIRONMENT & LOCATION LOCK:\n{continuity_anchor.environment_dna}"
                        )

                    if continuity_anchor.key_recurring_objects:
                        obj_list = "; ".join(continuity_anchor.key_recurring_objects)
                        continuity_blocks.append(
                            f"KEY RECURRING OBJECTS & PROPS (Maintain identical visual shape/color):\n{obj_list}"
                        )

                    if continuity_anchor.color_palette_tokens:
                        palette_str = ", ".join(continuity_anchor.color_palette_tokens)
                        continuity_blocks.append(
                            f"UNIFIED COLOR GRADING PALETTE: {palette_str}"
                        )

                continuity_block_str = "\n\n".join(continuity_blocks)

                video_prompt = f"""
Create a highly stylized video shot with fluid motion and strict universal object/character continuity.

CONTENT TITLE:
{blueprint.title}

SCENE {scene.scene_number} of {len(blueprint.scenes)}:
{scene.title}

SHOT #{shot.shot_number} of {len(planned_shots)} ({shot_type_label}):
{shot.purpose}

CHRONOLOGICAL SHOT ACTION (Beat {shot.shot_number}/{len(planned_shots)}):
{shot_action_beat}

CAMERA DIRECTION:
{shot.camera_direction}

CAMERA & SUBJECT MOTION:
{shot.motion}

SCENE VISUAL CONTEXT:
{scene.visual_description}

ARTISTIC RENDERING STYLE & GENRE AESTHETIC:
- Target Aesthetic: {style_info['label']}
- Style Directive: {style_info['description']}
- Lighting & Color Grading: {style_info['lighting_and_color']}
- Lens & Camera Mechanics: {style_info['camera_and_lens']}
- Texture & Film Cadence: {style_info['texture_and_cadence']}
{persona_context}

{continuity_block_str}

CONTINUITY REQUIREMENTS:
{shot.continuity_requirements}

IMPORTANT:
Do not display written text or subtitles in the video.
Focus on visual action progression and genre-accurate artistic rendering.
Preserve subject and object identity strictly from frame 1 to the final frame.
"""

                shots_started += 1
                report(
                    "stage",
                    stage="shots",
                    message=(
                        f"Generating Veo shot {shots_started}/{total_shots} "
                        f"(scene {scene.scene_number}, shot {shot.shot_number})..."
                    ),
                )

                is_host_shot = "A-Roll" in shot_type_label or "Host" in shot_type_label
                video_path = video_service.generate_shot_video(
                    prompt=video_prompt,
                    content_id=asset_key,
                    scene_number=scene.scene_number,
                    shot_number=shot.shot_number,
                    duration_seconds=shot.duration_seconds,
                    reference_images=[reference_image] if reference_image and is_host_shot else None,
                )
                report("shot_completed")

                asset_obj = {
                    "shot_number": shot.shot_number,
                    "scene_number": scene.scene_number,
                    "duration_seconds": shot.duration_seconds,
                    "generation_method": shot.generation_method,
                    "video_path": video_path,
                }
                scene_shot_assets.append(asset_obj)
                overall_shot_assets.append(asset_obj)

            # Compose Scene Shots into Scene MP4
            report(
                "stage",
                stage="assembling",
                message=f"Composing, narrating and captioning scene {scene.scene_number}/{len(blueprint.scenes)}...",
            )
            scene_video_path = None
            composition_status = "not_attempted"
            composition_message = ""

            try:
                scene_video_path = composition_service.compose_scene(
                    content_id=asset_key,
                    scene_number=scene.scene_number,
                    shot_uris=[asset["video_path"] for asset in scene_shot_assets],
                )

                if scene_video_path:
                    composition_status = "completed"
                else:
                    composition_status = "skipped"
                    composition_message = (
                        "Shot composition skipped. Install ffmpeg in runtime "
                        "to generate a composed scene MP4."
                    )
            except Exception as composition_exc:
                composition_status = "failed"
                composition_message = str(composition_exc)

            # Narrate, merge and caption the composed scene
            narration_out = _narrate_scene(
                asset_key=asset_key,
                scene=scene,
                scene_video_path=scene_video_path,
                language=blueprint.language or request.language,
                voice_gender=voice_gender,
                speaking_rate=speaking_rate,
                captions_enabled=request.captions_enabled,
                footage_seconds=float(sum(shot.duration_seconds for shot in planned_shots)) or None,
            )

            # Collect active video path for whole-video stitching
            best_scene_uri = narration_out["preview_video_path"]
            if best_scene_uri:
                scene_video_uris.append(best_scene_uri)

            scenes_output.append({
                "scene_number": scene.scene_number,
                "scene_title": scene.title,
                "duration_seconds": scene.duration_seconds,
                "shot_plan": [
                    {
                        "shot_number": shot.shot_number,
                        "duration_seconds": shot.duration_seconds,
                        "purpose": shot.purpose,
                        "camera_direction": shot.camera_direction,
                        "motion": shot.motion,
                        "generation_method": shot.generation_method,
                    }
                    for shot in planned_shots
                ],
                "shot_assets": scene_shot_assets,
                "scene_video_path": scene_video_path,
                "composition_status": composition_status,
                "composition_message": composition_message,
                **narration_out,
            })
            report("scene", scene=scenes_output[-1])

        # Step 3: Stitch all scenes together into the Complete Master Video Experience
        report("stage", stage="stitching", message="Stitching all scenes into the final draft...")
        final_video_uri, render_status, render_message = _stitch_scenes(asset_key, scene_video_uris)

        # Step 4: Dubbed versions of the same footage for each localization target language.
        localizations = []
        targets = _localization_targets(request.target_languages, blueprint.language or request.language)
        if targets:
            localizations = _localize_version(
                blueprint=blueprint,
                version_asset_key=asset_key,
                targets=targets,
                composed={s["scene_number"]: s["scene_video_path"] for s in scenes_output if s.get("scene_video_path")},
                footage={s["scene_number"]: _scene_footage_seconds(sc, s) for s, sc in zip(scenes_output, blueprint.scenes)},
                voice_gender=voice_gender,
                speaking_rate=speaking_rate,
                captions_enabled=request.captions_enabled,
                progress=report,
            )

        result = _build_video_result(
            blueprint=blueprint,
            scenes_output=scenes_output,
            shot_assets=overall_shot_assets,
            final_video_uri=final_video_uri,
            render_status=render_status,
            render_message=render_message,
            face_reference_used=reference_image is not None,
            localizations=localizations,
        )
        _persist_video_result(blueprint.content_id, blueprint.version, result)
        return result

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Video generation failed: {str(exc)}",
        )


@app.post("/api/create-video")
def create_video(request: CreateRequest):
    return _run_create_video(request)


def _run_video_job(job_id: str, work: Callable[[ProgressCallback], dict]) -> None:
    def on_progress(event: str, **data: Any) -> None:
        if event == "stage":
            video_jobs.update(job_id, stage=data["stage"], message=data["message"])
        elif event == "blueprint":
            video_jobs.update(job_id, **data)
        elif event == "shot_completed":
            video_jobs.increment_shots(job_id)
        elif event == "scene":
            video_jobs.append_scene(job_id, data["scene"])
        elif event == "localization":
            video_jobs.append_localization(job_id, data["localization"])

    video_jobs.update(job_id, status="queued", stage="queued", message="Waiting for a free render slot...")
    with video_render_slots:
        video_jobs.update(job_id, status="running", stage="starting", message="Starting video generation...")
        try:
            result = work(on_progress)
            video_jobs.update(
                job_id,
                status="completed",
                stage="completed",
                message=result.get("render_message") or "Video generation completed.",
                final_video_uri=result.get("final_video_uri"),
                result=result,
            )
        except HTTPException as exc:
            video_jobs.update(job_id, status="failed", stage="failed", message="Video generation failed.", error=str(exc.detail))
        except Exception as exc:
            video_jobs.update(job_id, status="failed", stage="failed", message="Video generation failed.", error=str(exc))


def _start_video_job(work: Callable[[ProgressCallback], dict]) -> dict:
    job = video_jobs.create()
    threading.Thread(target=_run_video_job, args=(job["job_id"], work), daemon=True).start()
    return job


@app.post("/api/create-video-jobs", status_code=202)
def start_create_video_job(request: CreateRequest):
    """Start video generation in the background so the UI can preview scenes as they finish."""
    return _start_video_job(lambda progress: _run_create_video(request, progress=progress))


@app.post("/api/adapt-video-jobs", status_code=202)
def start_adapt_video_job(request: AdaptRequest):
    """Adapt the Content DNA to the next version, then render that version as a new video."""

    def work(progress: ProgressCallback) -> dict:
        target = (request.content_id or "").strip() or (
            request.base_blueprint.content_id if request.base_blueprint else "new content"
        )
        progress("stage", stage="adapting", message=f"Adapting Content DNA of '{target}' to the next version with Gemini...")
        try:
            adapted = _adapt_blueprint(request)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Adaptation failed: {str(exc)}")
        return _run_create_video(request.base_request, progress=progress, blueprint=adapted)

    return _start_video_job(work)


@app.post("/api/blueprint-video-jobs", status_code=202)
def start_blueprint_video_job(request: BlueprintVideoRequest):
    """Render an existing Content DNA version (e.g. a transformed or adapted blueprint) as video."""
    return _start_video_job(
        lambda progress: _run_create_video(request.options, progress=progress, blueprint=request.blueprint)
    )


def _composed_scene_videos(content_id: str, version: int, video_result: Optional[dict]) -> dict:
    """Composed (pre-narration) scene videos of a version, from its saved result or its files."""
    composed = {
        scene["scene_number"]: scene["scene_video_path"]
        for scene in (video_result or {}).get("scenes", [])
        if scene.get("scene_video_path") and is_valid_gs_uri(scene["scene_video_path"])
    }
    if not composed:
        assets = content_store.scan(content_id).get(version)
        composed = dict(assets.composed_scene_videos) if assets else {}
    return composed


@app.post("/api/content/{content_id}/revoice-jobs", status_code=202)
def start_revoice_job(content_id: str, request: RevoiceRequest):
    """Re-narrate an existing video with another voice, reusing its Veo footage (no new shots)."""
    content_id = _require_content_id(content_id)
    voice_override = None
    if request.voice_gender:
        voice_override = normalize_voice_gender(request.voice_gender)
        if voice_override is None:
            raise HTTPException(status_code=422, detail="voice_gender must be 'male' or 'female'.")

    def work(progress: ProgressCallback) -> dict:
        progress("stage", stage="loading", message=f"Loading '{content_id}'...")
        record = _load_content(content_id, request.version)
        blueprint: ContentBlueprint = record["blueprint"]
        version = record["version"]
        previous = record["video_result"] or {}

        composed = _composed_scene_videos(content_id, version, previous)
        missing = [scene.scene_number for scene in blueprint.scenes if scene.scene_number not in composed]
        if missing:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Scene(s) {missing} of '{content_id}' v{version} have no rendered footage to re-voice. "
                    "Generate the video for this version instead."
                ),
            )

        voice_gender, speaking_rate = _resolve_narration_voice(blueprint)
        if voice_override:
            voice_gender = voice_override
            current = blueprint.narration_voice or NarrationVoice()
            blueprint.narration_voice = current.model_copy(update={"gender": voice_override})
            _persist_blueprint(blueprint)

        progress(
            "blueprint",
            content_id=content_id,
            version=version,
            title=blueprint.title,
            total_scenes=len(blueprint.scenes),
            total_shots=0,
            face_reference_used=bool(previous.get("face_reference_used")),
        )

        previous_scenes = {scene.get("scene_number"): scene for scene in previous.get("scenes", [])}
        asset_key = f"{content_id}/v{version}"
        scenes_output = []
        scene_video_uris = []

        for scene in blueprint.scenes:
            progress(
                "stage",
                stage="assembling",
                message=f"Re-voicing scene {scene.scene_number}/{len(blueprint.scenes)} ({voice_gender or 'default'} voice)...",
            )
            narration_out = _narrate_scene(
                asset_key=asset_key,
                scene=scene,
                scene_video_path=composed[scene.scene_number],
                language=blueprint.language,
                voice_gender=voice_gender,
                speaking_rate=speaking_rate,
                captions_enabled=request.captions_enabled,
                footage_seconds=_scene_footage_seconds(scene, previous_scenes.get(scene.scene_number)),
            )
            if narration_out["preview_video_path"]:
                scene_video_uris.append(narration_out["preview_video_path"])

            prior = previous_scenes.get(scene.scene_number, {})
            scenes_output.append({
                "scene_number": scene.scene_number,
                "scene_title": scene.title,
                "duration_seconds": scene.duration_seconds,
                "shot_plan": prior.get("shot_plan", []),
                "shot_assets": prior.get("shot_assets", []),
                "scene_video_path": composed[scene.scene_number],
                "composition_status": "completed",
                "composition_message": "Reused existing footage.",
                **narration_out,
            })
            progress("scene", scene=scenes_output[-1])

        progress("stage", stage="stitching", message="Stitching the re-voiced scenes into the final draft...")
        final_video_uri, render_status, render_message = _stitch_scenes(asset_key, scene_video_uris)

        # Existing localized versions keep their translations but get the new voice too.
        footage = {
            scene.scene_number: _scene_footage_seconds(scene, previous_scenes.get(scene.scene_number))
            for scene in blueprint.scenes
        }
        localizations = []
        for previous_localization in previous.get("localizations", []):
            translated = {
                scene.get("scene_number"): scene.get("narration")
                for scene in previous_localization.get("scenes", [])
                if scene.get("narration")
            }
            code = previous_localization.get("language_code")
            if not code or any(not translated.get(scene.scene_number) for scene in blueprint.scenes):
                localizations.append(previous_localization)
                continue
            try:
                localizations.append(_render_localization(
                    blueprint, asset_key, previous_localization.get("language") or code, code,
                    previous_localization.get("title") or blueprint.title, translated, composed, footage,
                    voice_gender, speaking_rate, request.captions_enabled, progress,
                ))
            except Exception as exc:
                localizations.append({**previous_localization, "status": "failed", "error": str(exc)})
            progress("localization", localization=localizations[-1])

        result = _build_video_result(
            blueprint=blueprint,
            scenes_output=scenes_output,
            shot_assets=[asset for scene in scenes_output for asset in scene["shot_assets"]],
            final_video_uri=final_video_uri,
            render_status=render_status,
            render_message=render_message,
            face_reference_used=bool(previous.get("face_reference_used")),
            localizations=localizations,
        )
        _persist_video_result(content_id, version, result)
        return result

    return _start_video_job(work)


@app.post("/api/content/{content_id}/localize-jobs", status_code=202)
def start_localize_job(content_id: str, request: LocalizeRequest):
    """Add dubbed language versions to an existing video, reusing its footage (no new Veo shots)."""
    content_id = _require_content_id(content_id)

    def work(progress: ProgressCallback) -> dict:
        progress("stage", stage="loading", message=f"Loading '{content_id}'...")
        record = _load_content(content_id, request.version)
        blueprint: ContentBlueprint = record["blueprint"]
        version = record["version"]
        previous = record["video_result"] or {}

        targets = _localization_targets(request.languages, blueprint.language)
        if not targets:
            raise HTTPException(
                status_code=422,
                detail=f"Choose at least one language other than the video's own language ({blueprint.language}).",
            )

        composed = _composed_scene_videos(content_id, version, previous)
        missing = [scene.scene_number for scene in blueprint.scenes if scene.scene_number not in composed]
        if missing:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Scene(s) {missing} of '{content_id}' v{version} have no rendered footage to localize. "
                    "Generate the video for this version first."
                ),
            )

        progress(
            "blueprint",
            content_id=content_id,
            version=version,
            title=blueprint.title,
            total_scenes=len(blueprint.scenes),
            total_shots=0,
            face_reference_used=bool(previous.get("face_reference_used")),
        )
        previous_scenes = {scene.get("scene_number"): scene for scene in previous.get("scenes", [])}
        for scene in previous.get("scenes", []):
            progress("scene", scene=scene)

        voice_gender, speaking_rate = _resolve_narration_voice(blueprint)
        new_localizations = _localize_version(
            blueprint=blueprint,
            version_asset_key=f"{content_id}/v{version}",
            targets=targets,
            composed=composed,
            footage={
                scene.scene_number: _scene_footage_seconds(scene, previous_scenes.get(scene.scene_number))
                for scene in blueprint.scenes
            },
            voice_gender=voice_gender,
            speaking_rate=speaking_rate,
            captions_enabled=request.captions_enabled,
            progress=progress,
        )

        # Replace earlier renders of the same language; keep the others.
        replaced = {loc.get("language_code") or loc.get("language") for loc in new_localizations}
        kept = [
            loc for loc in previous.get("localizations", [])
            if (loc.get("language_code") or loc.get("language")) not in replaced
        ]
        result = {**previous, "localizations": kept + new_localizations, "blueprint": blueprint.model_dump()}
        _persist_video_result(content_id, version, result)

        done = [loc["language"] for loc in new_localizations if loc.get("final_video_uri")]
        result["render_message"] = (
            f"Added {', '.join(done)} version(s)." if done else "No localized version could be produced."
        )
        return result

    return _start_video_job(work)


@app.get("/api/create-video-jobs/{job_id}")
def get_create_video_job(job_id: str):
    job = video_jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Video job not found (the server may have restarted).")
    return job


@app.post("/api/generate-narration")
def generate_narration(request: GenerateNarrationRequest):
    try:
        audio_uri = narration_service.generate_audio(
            content_id=request.content_id,
            text=request.text,
            language_code=request.language_code,
            voice_name=request.voice_name,
            speaking_rate=request.speaking_rate,
            scene_number=request.scene_number,
            voice_gender=request.voice_gender,
        )

        return {
            "content_id": request.content_id,
            "scene_number": request.scene_number,
            "audio_uri": audio_uri,
            "status": "completed",
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Narration generation failed: {str(exc)}",
        )


@app.post("/api/compose-scene")
def compose_scene(request: ComposeSceneRequest):
    try:
        invalid_uris = [uri for uri in request.shot_uris if not is_valid_gs_uri(uri)]
        if invalid_uris:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Invalid shot URIs. Only gs:// URIs are supported.",
                    "invalid_uris": invalid_uris,
                },
            )

        scene_video_path = composition_service.compose_scene(
            content_id=request.content_id,
            scene_number=request.scene_number,
            shot_uris=request.shot_uris,
        )

        if not scene_video_path:
            return {
                "content_id": request.content_id,
                "scene_number": request.scene_number,
                "scene_video_path": None,
                "composition_status": "skipped",
                "composition_message": (
                    "FFmpeg unavailable in runtime. Install ffmpeg "
                    "to compose shot videos."
                ),
            }

        return {
            "content_id": request.content_id,
            "scene_number": request.scene_number,
            "scene_video_path": scene_video_path,
            "composition_status": "completed",
            "composition_message": "Scene composition completed.",
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Scene composition failed: {str(exc)}",
        )


@app.post("/api/render-experience")
def render_experience(request: RenderExperienceRequest):
    try:
        invalid_scene_uris = [uri for uri in request.scene_uris if not is_valid_gs_uri(uri)]
        if invalid_scene_uris:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Invalid scene URIs. Only gs:// URIs are supported.",
                    "invalid_uris": invalid_scene_uris,
                },
            )

        if request.narration_audio_uri and not is_valid_gs_uri(request.narration_audio_uri):
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Invalid narration URI. Only gs:// URI is supported.",
                    "invalid_uri": request.narration_audio_uri,
                },
            )

        subtitle_valid, subtitle_validation_message = are_valid_subtitle_cues(request.subtitle_cues)
        if not subtitle_valid:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": subtitle_validation_message,
                },
            )

        base_video_uri = composition_service.compose_experience(
            content_id=request.content_id,
            scene_uris=request.scene_uris,
        )

        if not base_video_uri:
            return {
                "content_id": request.content_id,
                "final_video_uri": None,
                "base_video_uri": None,
                "subtitle_uri": None,
                "render_status": "skipped",
                "render_message": "FFmpeg unavailable in runtime. Install ffmpeg to render final experience.",
            }

        final_video_uri = base_video_uri
        narration_status = "not_requested"
        narration_message = ""

        if request.narration_audio_uri:
            try:
                muxed_uri = composition_service.merge_narration_audio(
                    content_id=request.content_id,
                    video_uri=base_video_uri,
                    audio_uri=request.narration_audio_uri,
                )

                if muxed_uri:
                    final_video_uri = muxed_uri
                    narration_status = "completed"
                else:
                    narration_status = "skipped"
                    narration_message = "FFmpeg unavailable in runtime for narration merge."
            except Exception as narration_exc:
                narration_status = "failed"
                narration_message = str(narration_exc)

        subtitle_uri = None
        subtitle_status = "not_requested"
        subtitle_message = ""
        caption_status = "not_requested"
        caption_message = ""

        if request.subtitle_cues:
            try:
                subtitle_uri = composition_service.create_subtitle_file(
                    content_id=request.content_id,
                    cues=request.subtitle_cues,
                )
                subtitle_status = "completed"
            except Exception as subtitle_exc:
                subtitle_status = "failed"
                subtitle_message = str(subtitle_exc)

            if request.burn_captions:
                try:
                    captioned_uri = composition_service.burn_captions(
                        content_id=request.content_id,
                        video_uri=final_video_uri,
                        cues=request.subtitle_cues,
                    )
                    if captioned_uri:
                        final_video_uri = captioned_uri
                        caption_status = "completed"
                    else:
                        caption_status = "skipped"
                        caption_message = "FFmpeg unavailable in runtime for caption burn-in."
                except Exception as caption_exc:
                    caption_status = "failed"
                    caption_message = str(caption_exc)

        return {
            "content_id": request.content_id,
            "base_video_uri": base_video_uri,
            "final_video_uri": final_video_uri,
            "subtitle_uri": subtitle_uri,
            "render_status": "completed",
            "narration_status": narration_status,
            "narration_message": narration_message,
            "subtitle_status": subtitle_status,
            "subtitle_message": subtitle_message,
            "caption_status": caption_status,
            "caption_message": caption_message,
            "render_message": "Final experience render pipeline completed.",
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Final render failed: {str(exc)}",
        )

# Serve the built studio frontend from the same service so the whole app is one URL.
# Registered last so every API route above takes precedence over the static files.
_frontend_dist = Path(settings.FRONTEND_DIST)
if (_frontend_dist / "index.html").is_file():
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="frontend")
else:
    @app.get("/")
    def root():
        return info()
