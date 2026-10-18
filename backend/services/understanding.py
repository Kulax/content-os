from google.genai.types import GenerateContentConfig

from backend.models import ContentUnderstanding, UnderstandRequest
from backend.prompts import UNDERSTANDING_SYSTEM_PROMPT
from backend.services.gemini import GeminiService


class UnderstandingService:
    def __init__(self):
        self.gemini = GeminiService()

    def analyze(self, request: UnderstandRequest) -> ContentUnderstanding:
        user_prompt = f"""
AUDIENCE LEVEL:
{request.audience_level}

SOURCE CONTENT:
{request.content_text}

Produce structured semantic understanding for CONTENT OS.
"""

        response = self.gemini.generate(
            contents=[
                UNDERSTANDING_SYSTEM_PROMPT,
                user_prompt,
            ],
            config=GenerateContentConfig(
                temperature=0.2,
                response_mime_type="application/json",
                response_schema=ContentUnderstanding,
            ),
        )

        if not response.text:
            raise RuntimeError("Gemini returned an empty response.")

        return ContentUnderstanding.model_validate_json(response.text)
