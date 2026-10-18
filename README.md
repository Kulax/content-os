# CONTENT OS

CONTENT OS is an AI Content Experience Engine for the Google + H2S AI Builder Cup.

The core thesis:

- Content meaning should be separated from content format.
- Content DNA should stay stable.
- Experience delivery should adapt by user context and purpose.

## Current Backend Capabilities

- Create structured Content DNA with Gemini.
- Generate Veo shot assets from planned scenes.
- Plan Veo-compatible shot durations (4/6/8 seconds) from semantic scene durations.
- Compose shot assets into scene-level MP4 output when ffmpeg is available.

## API Endpoints

- `GET /health`
- `POST /api/create`
- `POST /api/create-video`
- `POST /api/create-video-jobs` (background video generation with live progress)
- `POST /api/adapt-video-jobs` (adapt Content DNA to the next version and render it as video)
- `POST /api/blueprint-video-jobs` (render an existing Content DNA version as video)
- `GET /api/create-video-jobs/{job_id}` (progress/result for any of the video jobs above)
- `GET /api/content` (content IDs in the output bucket)
- `GET /api/content/{content_id}` (load a saved Content DNA version and its video)
- `POST /api/refine-prompt` (rewrite a rough input into a stronger prompt with Gemini; `field` is
  `visual_anchor`, `creator_prompt`, `transform_goal` or `adaptation_instruction`, plus optional `context`)
- `GET /api/media?uri=gs://...` (streams generated media for in-browser preview)
- `POST /api/upload-persona-photo`
- `POST /api/generate-narration`
- `POST /api/compose-scene`
- `POST /api/render-experience`
- `POST /api/transform`
- `POST /api/adapt`
- `POST /api/understand`
- `POST /api/ideate-trends`
- `POST /api/ideate-youtube-trends`

### `POST /api/create-video`

Current behavior:

- Generates shot assets for scene 1 from Veo.
- Attempts scene composition from shot assets.
- Generates narration audio with Google Cloud TTS from scene narration text.
- Attempts to merge narration audio with composed scene video (narration replaces the Veo soundtrack).
- Burns narration captions into each scene (timed to the narration audio) when `captions_enabled` is `true` (default).

Response includes:

- shot-level outputs
- scene composition status
- narration audio URI/status
- narrated scene video URI/status
- captioned scene video URI/status (`captioned_scene_video_path`, `caption_status`)
- `face_reference_used` when the creator photo was sent to Veo

### `POST /api/create-video-jobs` and `GET /api/create-video-jobs/{job_id}`

Runs the same pipeline as `/api/create-video` in the background and returns a `job_id` immediately.
Poll the job to get live progress (`stage`, `message`, `completed_shots`/`total_shots`), each finished
scene as soon as it is ready (`scenes[]`, with `preview_video_path`), and finally `final_video_uri` and
the full `result`. The studio UI uses this for its live scene-by-scene and final-draft preview.

Jobs are kept in server memory: they are lost on restart and are not shared across multiple instances.

### `GET /api/media?uri=gs://...`

Streams a generated asset from the private output bucket (with HTTP Range support for seeking) so the
browser can play it. Only URIs under `GENERATED_VIDEOS_BUCKET` are served.

### Featuring the creator's face

Upload a clear, front-facing photo with `POST /api/upload-persona-photo` (PNG/JPEG/WebP, max 10 MB).
The response includes `gcs_uri`; pass it as `creator_persona.reference_image_uri`. Host (A-roll) shots are
then generated with the photo as a Veo subject reference image. Veo only supports 8-second clips for
reference-to-video, so scenes are planned in 8-second shots when a photo is attached. The
`b_roll_focused` presentation mode does not use the photo.

### `POST /api/transform`

Transforms source material into a new Content DNA experience plan.

- Input includes source text and target parameters.
- Output is a Content Blueprint with planned shots.

### `POST /api/adapt`

Adapts an existing creation intent while preserving core meaning.

- Input includes a base request plus adaptation instruction.
- Pass `base_blueprint` (the current Content DNA) so the new version evolves it instead of starting over.
- Output keeps the `content_id`, increments version and returns adapted Content Blueprint with shots.
- `/api/adapt` only produces the blueprint. Use `POST /api/adapt-video-jobs` (same body) to adapt and
  render the new version as a video, or `POST /api/blueprint-video-jobs` with `{ blueprint, options }`
  to render any existing version. Each version's media is stored under `<content_id>/v<version>/`.
- If only `content_id` is sent (no `base_blueprint`), the latest saved version of that content is loaded
  and evolved. Unknown content IDs return `404` instead of falling back to the request prompt.
- The new version number is always higher than any version that already has files in the bucket.

### `GET /api/content` and `GET /api/content/{content_id}?version=N`

Every Content DNA version is saved as `<content_id>/v<version>/blueprint.json` (plus `video.json` with
the render result) in `GENERATED_VIDEOS_BUCKET`. `GET /api/content` lists the content IDs in the bucket;
`GET /api/content/{content_id}` returns the latest version that has a saved plan or a finished video
(or `?version=N`), its blueprint, all known versions and the rendered video for preview.

For videos rendered before blueprints were saved, the blueprint is rebuilt once by having Gemini
watch the scene videos (narration is transcribed from the audio and burned-in captions), then saved.
The response sets `recovered: true` in that case.

New content gets a unique backend-assigned ID (`<readable-slug>-<6 hex chars>`), so two videos on the
same topic never overwrite each other's files.

### Narrator voice

Blueprints carry `narration_voice` (`gender`, `speaking_rate`, `delivery`). Gemini fills it from the
request (e.g. "masculine voice") or the on-camera host, and adaptations change it when asked. Narration
uses a Chirp3-HD voice of that gender in the content's language (`TTS_VOICE_NAME` stays the default when
no gender is requested). Older plans without `narration_voice` fall back to the gender implied by
`narration_style` / persona text.

`POST /api/content/{content_id}/revoice-jobs` with `{ "version": 4, "voice_gender": "male" }` re-narrates
an existing version with another voice, reusing its Veo footage (no new shots); poll it with
`GET /api/create-video-jobs/{job_id}`. Existing localized versions are re-voiced too.

### Localized (dubbed) versions

`target_languages` on create requests (the "Multilingual Localization Targets" chips in the studio) adds a
dubbed version per language after the main video is rendered in the primary `language`: Gemini translates
each scene's narration (fitted to the scene length), Cloud TTS speaks it with the same narrator voice in that
language, captions are burned in that script, and the scenes are stitched into a localized final video.
The footage is reused, so there is no extra Veo cost. The primary language is skipped; unsupported
languages are reported in the result instead of being ignored.

Results are in `localizations[]` of the video result (`language`, `language_code`, `title`,
`final_video_uri`, per-scene `narration`). Files are stored under `<content_id>/v<version>/<language-code>/`.

`POST /api/content/{content_id}/localize-jobs` with `{ "languages": ["Hindi"], "version": 1 }` adds
dubbed versions to a video that already exists.

Narration that comes out longer than a scene's footage is re-synthesized slightly faster (up to 1.35x)
so it isn't cut off. Captions are rendered with complex text shaping, so scripts like Devanagari display
correctly; the Docker image installs Noto fonts for Devanagari and CJK.

### `POST /api/understand`

Produces structured semantic understanding.

- Key concepts and definitions
- Relationships
- Claims with confidence scores
- Uncertainty notes

### `POST /api/ideate-trends`

Trend ideation layer for discovery-first creation.

- Ingests trend signals from YouTube titles, captions, video notes, and optional MCP dumps.
- Produces key trend insights and ranked content ideas.
- Returns a `top_create_request` object that can be passed directly into create/video endpoints.

Request fields:

- `topic` (optional)
- `audience_level`
- `language`
- `max_ideas` (1-10)
- `signals[]` where each signal includes:
	- `source_type`
	- `text`
	- `source_label` (optional)
	- `source_url` (optional)
- `mcp_dump` (optional raw text)
- `additional_context` (optional)

Response highlights:

- `summary`
- `top_insights[]`
- `ideas[]` (each with `create_prompt`)
- `top_create_request` (ready for `POST /api/create` or `POST /api/create-video`)

### `POST /api/ideate-youtube-trends`

Direct YouTube trend discovery pipeline.

- Fetches trending videos directly from YouTube by category and region.
- YouTube has no "most popular" chart for some categories (Education and Travel & Events return 404 in
  every region), so those fall back to the most-viewed videos uploaded in the last 7 days (30 if too few)
  for that category and region, biased toward the requested language. `source_note` in the response says
  which source was used. The fallback uses YouTube search, which costs 100 quota units per call.
- Converts fetched data into trend signals.
- Runs AI summarization/ideation and returns create-ready output.

Request fields:

- `category` (example: `entertainment`, `news`, `education`, `music`, `sports`, `gaming`, `technology`)
- `category_id` (optional explicit category ID override)
- `region_code` (2-letter code, example: `US`)
- `max_results` (5-50)
- `audience_level`
- `language`
- `max_ideas` (1-10)
- `topic_override` (optional)
- `additional_context` (optional)

Response highlights:

- `trending_videos[]` with video metadata and watch URLs
- `ideation.summary`
- `ideation.top_insights[]`
- `ideation.ideas[]`
- `ideation.top_create_request`

### `POST /api/render-experience`

Builds a final experience artifact from scene-level URIs.

- Concatenates ordered scene videos into a final timeline.
- Optionally merges narration audio into the final video.
- Optionally generates and uploads an SRT subtitle file.
- Burns `subtitle_cues` into the final video as captions when `burn_captions` is `true` (default).

Request fields:

- `content_id`
- `scene_uris[]` (ordered `gs://` paths)
- `narration_audio_uri` (optional `gs://` path)
- `subtitle_cues[]` (optional list of timed subtitle cues)
- `burn_captions` (optional, default `true`)

## Local Setup

1. Create a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Set environment variables:

- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_CLOUD_LOCATION` (default is `global`)
- `GEMINI_MODEL` (default is `gemini-2.5-flash`)
- `VEO_MODEL` (default is `veo-3.1-generate-001`)
- `GENERATED_VIDEOS_BUCKET` (example: `gs://your-bucket/generated-videos`)
- `FFMPEG_BINARY` (default is `ffmpeg`)
- `TTS_LANGUAGE_CODE` (default is `en-US`)
- `TTS_VOICE_NAME` (example: `en-US-Chirp3-HD-Achernar`)
- `TTS_SPEAKING_RATE` (default is `1.0`)
- `YOUTUBE_API_KEY` (required for `/api/ideate-youtube-trends`)

4. Start API:

```bash
uvicorn backend.main:app --reload
```

5. Start frontend studio:

```bash
cd frontend
npm ci
npm run dev
```

Then open `http://127.0.0.1:5173`. The studio talks to the backend at `http://127.0.0.1:8000`; to use another
backend, set `VITE_API_BASE_URL` (for example in `frontend/.env.local`) before `npm run dev` / `npm run build`.

## Cloud Run Deployment

See deployment steps in `docs/deployment.md`.

## Product and Submission Docs

- Architecture: `ARCHITECTURE.md`
- Demo plan: `docs/demo.md`
- Pitch deck structure: `docs/pitch-deck-outline.md`
- Submission checklist: `docs/submission-checklist.md`
