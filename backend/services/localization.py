from typing import List

from google.genai.types import GenerateContentConfig
from pydantic import BaseModel, Field

from backend.models import ContentBlueprint
from backend.services.gemini import GeminiService


LOCALIZATION_SYSTEM_PROMPT = """
You are CONTENT OS localization. You translate the spoken narration of an existing video
into another language for a dubbed version that reuses the same footage.

Rules:
1. Translate every scene's narration into the target language, written in that language's native
   script (e.g. Devanagari for Hindi), as a native speaker would naturally SAY it aloud.
   Prefer everyday spoken wording over formal or literary wording; keep common English
   technology terms (like "AI") when that is how native speakers say them.
2. Keep the meaning, tone, emotion and calls to action. Keep names unchanged.
3. Each scene's spoken length must fit its scene duration: aim for roughly the same speaking
   time as the original and never noticeably longer. Shorten wording if needed.
4. Keep sentences short and end them with the target language's sentence punctuation.
5. Also translate the title.

Return only JSON matching the schema.
"""


class LocalizedScene(BaseModel):
    scene_number: int
    narration: str


class LocalizedScript(BaseModel):
    title: str
    scenes: List[LocalizedScene] = Field(default_factory=list)


class LocalizationService:
    def __init__(self):
        self.gemini = GeminiService()

    def translate_narration(self, blueprint: ContentBlueprint, target_language: str) -> LocalizedScript:
        scene_lines = "\n\n".join(
            f"SCENE {scene.scene_number} (about {scene.duration_seconds} seconds):\n{scene.narration}"
            for scene in blueprint.scenes
        )
        user_prompt = f"""
SOURCE LANGUAGE: {blueprint.language}
TARGET LANGUAGE: {target_language}
TONE: {blueprint.tone}
NARRATION STYLE: {blueprint.narration_style}

TITLE:
{blueprint.title}

NARRATION:
{scene_lines}
"""
        response = self.gemini.generate(
            contents=[LOCALIZATION_SYSTEM_PROMPT, user_prompt],
            config=GenerateContentConfig(
                temperature=0.3,
                response_mime_type="application/json",
                response_schema=LocalizedScript,
            ),
        )
        if not response.text:
            raise RuntimeError("Gemini returned an empty translation.")

        script = LocalizedScript.model_validate_json(response.text)
        translated = {scene.scene_number: scene.narration.strip() for scene in script.scenes}
        missing = [scene.scene_number for scene in blueprint.scenes if not translated.get(scene.scene_number)]
        if missing:
            raise RuntimeError(f"Translation is missing scene(s) {missing}.")
        return script
