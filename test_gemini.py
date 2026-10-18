from google import genai
from google.genai.types import HttpOptions


client = genai.Client(
    vertexai=True,
    project="ai-builder-cup-510507",
    location="global",
    http_options=HttpOptions(api_version="v1"),
)


response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Say hello to CONTENT OS in one sentence."
)


print(response.text)