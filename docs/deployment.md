# Deployment Guide (Cloud Run)

CONTENT OS deploys as **one public Cloud Run service**: the container builds the studio frontend and the
FastAPI backend serves it, so the whole app is a single URL (`https://<service>-<hash>.<region>.run.app`).

## One-command deploy (Windows PowerShell)

From the repository root, signed in with `gcloud auth login` as a project owner:

```powershell
.\deploy.ps1                       # defaults: project nexus-ai-builder-511215, region us-east1, bucket gs://nexus12/generated-videos, 120s max video
.\deploy.ps1 -Project my-project -Bucket gs://my-bucket/generated-videos -Region us-central1
```

Current deployment: **https://content-os-153517609775.us-east1.run.app** (service `content-os`, region `us-east1`).

The script:

1. Enables the APIs: Cloud Run, Cloud Build, Artifact Registry, Vertex AI, Text-to-Speech, Cloud Storage,
   YouTube Data API v3 and Secret Manager.
2. Creates the runtime service account `content-os-runtime` with `roles/aiplatform.user`,
   `roles/serviceusage.serviceUsageConsumer` and `roles/storage.objectAdmin` on the output bucket.
3. Stores the YouTube API key in Secret Manager (`youtube-api-key`), read from `-YouTubeApiKey` or the local
   `.env`, and lets the service account read it.
4. Builds the `Dockerfile` with Cloud Build (`gcloud run deploy --source .`, no local Docker needed) and deploys.
5. Prints the URL and checks `/health` and the studio page.

`.gcloudignore` / `.dockerignore` keep `.env`, virtual environments, `node_modules` and uploaded face photos
(`backend/uploads`) out of the upload and the image.

## Cloud Run settings and why

| Setting | Value | Reason |
|---|---|---|
| `--allow-unauthenticated` | public | Evaluators open the link without signing in. |
| `--min-instances` / `--max-instances` | 1 / 1 | Always warm (no cold start during evaluation). Video job progress lives in instance memory, so every poll must reach the same instance. |
| `--no-cpu-throttling` | CPU always allocated | Video jobs run in background threads between progress polls. |
| `--cpu` / `--memory` | 2 / 4Gi | ffmpeg composition, narration muxing and caption burn-in. |
| `--timeout` | 3600 | Media streaming and the synchronous `/api/create-video` endpoint. |

Approximate idle cost of one always-on 2 vCPU / 4 GiB instance is a few US dollars per day, plus usage
(Veo, Gemini, Text-to-Speech, storage). Lower it after evaluation with
`gcloud run services update content-os --region us-east1 --min-instances 0`.

## Environment variables

Set by `deploy.ps1`:

- `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION=global`
- `GEMINI_MODEL=gemini-2.5-flash`, `VEO_MODEL=veo-3.1-generate-001`
- `VEO_GENERATE_AUDIO=false`: Veo's soundtrack is replaced by the narration anyway, so it isn't generated (lower Veo cost).
- `GENERATED_VIDEOS_BUCKET` (e.g. `gs://nexus12/generated-videos`)
- `YOUTUBE_API_KEY` (from Secret Manager)
- `MAX_VIDEO_SECONDS` (deployed with 120; app default 60): longest video a request may generate. Public deployments are billed per
  Veo second, so plans longer than this are refused with a clear message.
- `MAX_CONCURRENT_VIDEO_JOBS` (default 2): renders running at once; further jobs wait in a queue.

Optional: `TTS_LANGUAGE_CODE`, `TTS_VOICE_NAME`, `TTS_SPEAKING_RATE`, `CORS_ALLOW_ORIGINS` (comma-separated,
default `*`), `FFMPEG_BINARY` (the image uses the system `ffmpeg`).

Do **not** copy the local proxy settings from `.env` (`REQUESTS_CA_BUNDLE`, `SSL_CERT_FILE`,
`GRPC_DEFAULT_SSL_ROOTS_FILE_PATH`); they point at files on the development machine.

## Post-deployment validation

1. Open the service URL: the studio loads and the header shows the project name (backend reachable).
2. `GET /health` returns `healthy` and `max_video_seconds`.
3. Create & DNA: **Create Content DNA** (Gemini).
4. Create & DNA: **Create Video + Narration** with a short duration (Veo, Text-to-Speech, ffmpeg); the live
   preview shows scenes and the final draft.
5. Trend Radar: fetch a category (YouTube API).
6. Transform & Adapt: load a content ID and adapt it.

## Updating

Re-run `.\deploy.ps1`. Deploying replaces the running instance, so in-progress video jobs are lost; deploy
when no one is rendering.

## Before going public

- **Rotate the YouTube API key.** An older key was committed in source code; create a new key restricted to the
  YouTube Data API v3, then `.\deploy.ps1 -YouTubeApiKey <new key>` to store it as a new secret version.
- The service has no login: anyone with the URL can generate videos (billed to the project) and view generated
  media. `MAX_VIDEO_SECONDS` and `MAX_CONCURRENT_VIDEO_JOBS` limit the impact; set a billing budget alert too.
