# CONTENT OS Architecture

## Product Loop

1. Understand
2. Plan
3. Generate
4. Experience
5. Observe
6. Adapt
7. Trend Ideate

## Core Abstractions

- Content DNA: Stable semantic source of truth.
- User Context: Lightweight personalization profile.
- Experience Plan: Scene-to-shot media plan.
- Adaptive Controls: Runtime refinements based on interaction.

## Current Technical Architecture

```text
FastAPI API (Cloud Run)
  |
  |-- BlueprintService (Gemini)
  |       -> Structured Content DNA
  |       -> Transform and Adapt variants
  |
  |-- UnderstandingService (Gemini)
  |       -> Concepts, relationships, claims, uncertainty
  |
  |-- TrendIdeationService (Gemini)
  |       -> YouTube/MCP trend synthesis
  |       -> Key insights and ranked content ideas
  |       -> Direct create-ready prompt handoff
  |
  |-- ExperiencePlannerService
  |       -> Veo-compatible shot plan (4/6/8 sec)
  |
  |-- VideoGenerationService (Veo)
  |       -> Shot-level video assets to GCS
  |
  |-- CompositionService (ffmpeg + GCS)
          -> Scene-level composed MP4
```

## Google Stack Mapping

- Gemini: Content DNA reasoning and structure.
- Veo: Cinematic shot generation.
- Cloud Storage: Asset persistence for shot and scene outputs.
- Cloud Run: API hosting.
- Optional next integrations:
  - Imagen for still fallback and diagram generation.
  - Gemini TTS for narration.
  - Translation for multilingual output.
  - BigQuery for anonymous interaction analytics.

## Design Principles

- Preserve semantic intent while changing experience format.
- Plan before generation.
- Regenerate selectively at shot level.
- Keep system demoable at each milestone.
