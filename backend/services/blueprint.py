import re
from typing import List, Tuple
from uuid import uuid4

from google.genai.types import GenerateContentConfig, Part

from backend.models import ContentBlueprint, CreateRequest
from backend.prompts import BLUEPRINT_RECONSTRUCTION_PROMPT, BLUEPRINT_SYSTEM_PROMPT
from backend.services.gemini import GeminiService
from backend.services.styles import resolve_style_profile


def new_content_id(hint: str) -> str:
    """Readable but unique ID, so new content never overwrites another video's files."""
    slug = re.sub(r"[^a-z0-9]+", "-", (hint or "").lower()).strip("-")
    slug = re.sub(r"-v\d+$", "", slug)[:48].strip("-") or "content"
    return f"{slug}-{uuid4().hex[:6]}"


class BlueprintService:
    def __init__(self):
        self.gemini = GeminiService()

    def generate(self, request: CreateRequest) -> ContentBlueprint:
        target_langs_str = ", ".join(request.target_languages) if request.target_languages else request.language
        persona_str = ""
        if request.creator_persona:
            persona_str = f"""
CREATOR DIGITAL TWIN / PERSONA:
- Name: {request.creator_persona.name}
- Role / Presenter Style: {request.creator_persona.role_title}
- Visual Anchor & Style: {request.creator_persona.visual_description}
- Voice Delivery: {request.creator_persona.voice_tone}
- Presentation Mode: {request.creator_persona.presentation_mode}
"""

        style_info = resolve_style_profile(request.visual_style)
        style_block = f"""
VISUAL RENDERING STYLE & GENRE AESTHETIC:
- Target Style: {style_info['label']}
- Style Directive: {style_info['description']}
- Lighting & Color Grading: {style_info['lighting_and_color']}
- Camera & Framing Technique: {style_info['camera_and_lens']}
- Texture & Cadence: {style_info['texture_and_cadence']}
"""

        user_prompt = f"""
USER CREATION REQUEST:
{request.prompt}

CREATION PARAMETERS:
Audience knowledge level:
{request.audience_level}

Target duration:
{request.duration_seconds} seconds

Primary Language:
{request.language}

Target Multilingual Scope:
{target_langs_str}

Format:
{request.format}
{style_block}

Tone:
{request.tone}
{persona_str}

Design the complete Content Blueprint with a clear creator execution plan and sequential visual descriptions adhering strictly to the visual style.
"""

        return self.generate_from_prompt(user_prompt)

    def generate_from_prompt(self, user_prompt: str) -> ContentBlueprint:

        response = self.gemini.generate(
            contents=[
                BLUEPRINT_SYSTEM_PROMPT,
                user_prompt,
            ],
            config=GenerateContentConfig(
                temperature=0.7,
                response_mime_type="application/json",
                response_schema=ContentBlueprint,
            ),
        )

        if not response.text:
            raise RuntimeError(
                "Gemini returned an empty response."
            )

        blueprint = ContentBlueprint.model_validate_json(
            response.text
        )

        # Content identity is always owned by the backend: new content gets a unique ID and v1.
        # (Adaptation overrides both with the existing content ID and the next version.)
        blueprint.content_id = new_content_id(blueprint.content_id or blueprint.title)
        blueprint.version = 1

        return blueprint

    def reconstruct_from_scene_videos(
        self,
        content_id: str,
        version: int,
        scene_videos: List[Tuple[int, str]],
    ) -> ContentBlueprint:
        """Rebuild a lost blueprint by having Gemini watch the rendered scene videos."""
        contents: list = [BLUEPRINT_RECONSTRUCTION_PROMPT]
        for scene_number, video_uri in scene_videos:
            contents.append(f"SCENE {scene_number} VIDEO:")
            contents.append(Part.from_uri(file_uri=video_uri, mime_type="video/mp4"))
        contents.append(
            f"Reconstruct the Content Blueprint for these {len(scene_videos)} scene video(s)."
        )

        response = self.gemini.generate(
            contents=contents,
            config=GenerateContentConfig(
                temperature=0.2,
                response_mime_type="application/json",
                response_schema=ContentBlueprint,
            ),
        )

        if not response.text:
            raise RuntimeError("Gemini returned an empty response while reconstructing the blueprint.")

        blueprint = ContentBlueprint.model_validate_json(response.text)
        blueprint.content_id = content_id
        blueprint.version = version
        for index, scene in enumerate(blueprint.scenes, start=1):
            scene.scene_number = index
            scene.shots = []

        return blueprint