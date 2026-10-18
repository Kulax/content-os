from typing import Dict

from google.genai.types import GenerateContentConfig
from pydantic import BaseModel

from backend.services.gemini import GeminiService


REFINE_SYSTEM_PROMPT = """
You are the CONTENT OS prompt refiner. A creator wrote a rough input for one field of a video
creation tool. Rewrite it so the downstream AI (Gemini for planning, Veo for video) produces
better results.

Rules:
- Keep every concrete detail and intent the creator gave; never contradict, soften or replace them.
  In particular keep their words for ethnicity/nationality, age, gender, emotion, facial expression,
  voice and clothing exactly as requested, even if they don't match the context (e.g. "angry" stays angry).
  Never swap a garment for another type (a jacket stays a jacket, not a blazer); only add material,
  colour shades and fit to it.
- Fill obvious gaps with sensible, specific choices that match the provided context.
- Be concrete and visual, not generic marketing language.
- Do not mention real, famous or public people by name; no logos or brand trademarks.
- Return only the rewritten text in `refined` (no quotes, labels or preamble) and one short
  sentence in `notes` describing what you improved.
"""

FIELD_GUIDES: Dict[str, str] = {
    "visual_anchor": """
FIELD: On-camera host visual anchor (used verbatim in every Veo shot prompt to keep the person consistent).
Write 2-4 sentences in English describing: apparent age range and build, skin tone, hair (style, colour),
face and expression/demeanour, exact clothing items with colours and materials, accessories, how they are
framed, the lighting and the background setting. Make it immutable and specific so every shot looks
like the same person.
If the context says a reference photo is provided, the photo defines the face: do not invent facial
features, skin tone, age or hair; focus on outfit, expression, framing, lighting and setting.
""",
    "creator_prompt": """
FIELD: Creation brief for a short video.
Rewrite as a clear brief of 50-120 words: the topic, the single key message, who it is for, what the
viewer should feel/learn/do, a narrative arc (hook -> explanation -> payoff/call to action) and 1-3
concrete examples or visuals worth showing. Respect the context (audience, duration, tone, language,
visual style). Write in the same language as the creator's text.
""",
    "transform_goal": """
FIELD: Goal for transforming source material (article, transcript, notes) into a video.
Rewrite as 1-3 sentences stating the target format, audience, length, angle, and what to keep versus
drop from the source. Write in the same language as the creator's text.
""",
    "adaptation_instruction": """
FIELD: Instruction for adapting an existing video into a new version.
Rewrite as 1-4 precise sentences listing exactly what to change (e.g. audience, tone, length, pacing,
narrator voice such as masculine/feminine, facial expressions, visuals, language) and what to keep.
Preserve every change the creator asked for explicitly, especially voice and expression requests.
Write in the same language as the creator's text.
""",
}


class RefinedPrompt(BaseModel):
    refined: str
    notes: str = ""


class PromptRefinerService:
    def __init__(self):
        self.gemini = GeminiService()

    def refine(self, field: str, text: str, context: Dict[str, str]) -> RefinedPrompt:
        guide = FIELD_GUIDES.get(field)
        if guide is None:
            raise ValueError(f"Unsupported field '{field}'. Use one of: {', '.join(FIELD_GUIDES)}.")

        context_lines = "\n".join(
            f"- {key}: {value}" for key, value in context.items() if value and str(value).strip()
        ) or "- (none)"

        user_prompt = f"""
{guide}
CONTEXT:
{context_lines}

CREATOR'S TEXT:
{text}
"""
        response = self.gemini.generate(
            contents=[REFINE_SYSTEM_PROMPT, user_prompt],
            config=GenerateContentConfig(
                temperature=0.35,
                response_mime_type="application/json",
                response_schema=RefinedPrompt,
            ),
        )
        if not response.text:
            raise RuntimeError("Gemini returned an empty response.")

        result = RefinedPrompt.model_validate_json(response.text)
        result.refined = result.refined.strip().strip('"').strip()
        if not result.refined:
            raise RuntimeError("Gemini returned an empty refinement.")
        return result
