from google.genai.types import GenerateContentConfig

from backend.models import TrendIdeationRequest, TrendIdeationResponse
from backend.prompts import TREND_IDEATION_SYSTEM_PROMPT
from backend.services.gemini import GeminiService


class TrendIdeationService:
    def __init__(self):
        self.gemini = GeminiService()

    def ideate(self, request: TrendIdeationRequest) -> TrendIdeationResponse:
        signal_lines = []
        for idx, signal in enumerate(request.signals, start=1):
            header = f"Signal {idx}"
            if signal.source_type:
                header += f" [{signal.source_type}]"
            if signal.source_label:
                header += f" {signal.source_label}"
            if signal.source_url:
                header += f" ({signal.source_url})"

            signal_lines.append(f"{header}\n{signal.text}")

        signal_block = "\n\n".join(signal_lines) if signal_lines else "No explicit signals provided."

        user_prompt = f"""
TOPIC FOCUS (optional):
{request.topic or 'Open discovery based on the provided trend signals.'}

TARGET AUDIENCE LEVEL:
{request.audience_level}

OUTPUT LANGUAGE:
{request.language}

MAX IDEAS:
{request.max_ideas}

TREND SIGNALS:
{signal_block}

OPTIONAL MCP DUMP:
{request.mcp_dump or 'None'}

ADDITIONAL CONTEXT:
{request.additional_context or 'None'}

Synthesize trends and output strategic ideation for CONTENT OS.
"""

        response = self.gemini.generate(
            contents=[
                TREND_IDEATION_SYSTEM_PROMPT,
                user_prompt,
            ],
            config=GenerateContentConfig(
                temperature=0.35,
                response_mime_type="application/json",
                response_schema=TrendIdeationResponse,
            ),
        )

        if not response.text:
            raise RuntimeError("Gemini returned an empty response.")

        return TrendIdeationResponse.model_validate_json(response.text)
