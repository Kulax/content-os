from google import genai
from google.genai.types import HttpOptions

from backend.config import settings


class GeminiService:
    def __init__(self):
        self.client = genai.Client(
            vertexai=True,
            project=settings.GOOGLE_CLOUD_PROJECT,
            location=settings.GOOGLE_CLOUD_LOCATION,
            http_options=HttpOptions(api_version="v1"),
        )

        self.model = settings.GEMINI_MODEL

    def generate(self, contents, config=None):
        return self.client.models.generate_content(
            model=self.model,
            contents=contents,
            config=config,
        )