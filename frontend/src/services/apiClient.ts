import {
  AdaptRequest,
  BlueprintVideoRequest,
  ComposeSceneRequest,
  ComposeSceneResponse,
  ContentBlueprint,
  ContentRecord,
  ContentSummary,
  ContentUnderstanding,
  CreateRequest,
  CreateVideoResponse,
  GenerateNarrationRequest,
  GenerateNarrationResponse,
  HealthResponse,
  LocalizeRequest,
  PersonaPhotoUploadResponse,
  RefinePromptRequest,
  RefinePromptResponse,
  RenderExperienceRequest,
  RenderExperienceResponse,
  RevoiceRequest,
  TransformRequest,
  TrendIdeationRequest,
  TrendIdeationResponse,
  UnderstandRequest,
  VideoJob,
  YouTubeTrendIdeationRequest,
  YouTubeTrendIdeationResponse,
} from '../types/api';

export class ApiClientError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
  }
}

export function normalizeBaseUrl(rawUrl: string): string {
  return rawUrl.trim().replace(/\/+$/, '');
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const cleanBase = normalizeBaseUrl(baseUrl);
  const url = `${cleanBase}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  } catch (networkErr) {
    throw new ApiClientError(
      `Cannot reach the CONTENT OS backend at ${cleanBase}. Check that the backend server is running.`,
      0,
      networkErr
    );
  }

  const rawText = await res.text();
  let parsed: any = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : {};
  } catch {
    parsed = { raw: rawText };
  }

  if (!res.ok) {
    let detailMsg = `HTTP ${res.status} (${res.statusText || 'Request failed'})`;
    if (typeof parsed?.detail === 'string') {
      detailMsg = parsed.detail;
    } else if (Array.isArray(parsed?.detail)) {
      detailMsg = parsed.detail
        .map((d: any) => `${d.loc?.slice(1)?.join('.') || 'field'}: ${d.msg}`)
        .join('; ');
    } else if (parsed?.detail?.message) {
      detailMsg = parsed.detail.message;
    }
    throw new ApiClientError(detailMsg, res.status, parsed);
  }

  return parsed as T;
}

export const contentOsApi = {
  checkHealth: (baseUrl: string) =>
    requestJson<HealthResponse>(baseUrl, '/health', { method: 'GET' }),

  createBlueprint: (baseUrl: string, payload: CreateRequest) =>
    requestJson<ContentBlueprint>(baseUrl, '/api/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createVideo: (baseUrl: string, payload: CreateRequest) =>
    requestJson<CreateVideoResponse>(baseUrl, '/api/create-video', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  startVideoJob: (baseUrl: string, payload: CreateRequest) =>
    requestJson<VideoJob>(baseUrl, '/api/create-video-jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getVideoJob: (baseUrl: string, jobId: string) =>
    requestJson<VideoJob>(baseUrl, `/api/create-video-jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
    }),

  startAdaptVideoJob: (baseUrl: string, payload: AdaptRequest) =>
    requestJson<VideoJob>(baseUrl, '/api/adapt-video-jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  startBlueprintVideoJob: (baseUrl: string, payload: BlueprintVideoRequest) =>
    requestJson<VideoJob>(baseUrl, '/api/blueprint-video-jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listContent: (baseUrl: string) =>
    requestJson<ContentSummary[]>(baseUrl, '/api/content', { method: 'GET' }),

  refinePrompt: (baseUrl: string, payload: RefinePromptRequest) =>
    requestJson<RefinePromptResponse>(baseUrl, '/api/refine-prompt', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getContent: (baseUrl: string, contentId: string, version?: number) =>
    requestJson<ContentRecord>(
      baseUrl,
      `/api/content/${encodeURIComponent(contentId)}${version ? `?version=${version}` : ''}`,
      { method: 'GET' }
    ),

  startRevoiceJob: (baseUrl: string, contentId: string, payload: RevoiceRequest) =>
    requestJson<VideoJob>(baseUrl, `/api/content/${encodeURIComponent(contentId)}/revoice-jobs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  startLocalizeJob: (baseUrl: string, contentId: string, payload: LocalizeRequest) =>
    requestJson<VideoJob>(baseUrl, `/api/content/${encodeURIComponent(contentId)}/localize-jobs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  transformContent: (baseUrl: string, payload: TransformRequest) =>
    requestJson<ContentBlueprint>(baseUrl, '/api/transform', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adaptContent: (baseUrl: string, payload: AdaptRequest) =>
    requestJson<ContentBlueprint>(baseUrl, '/api/adapt', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  understandContent: (baseUrl: string, payload: UnderstandRequest) =>
    requestJson<ContentUnderstanding>(baseUrl, '/api/understand', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  ideateTrends: (baseUrl: string, payload: TrendIdeationRequest) =>
    requestJson<TrendIdeationResponse>(baseUrl, '/api/ideate-trends', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  ideateYouTubeTrends: (baseUrl: string, payload: YouTubeTrendIdeationRequest) =>
    requestJson<YouTubeTrendIdeationResponse>(baseUrl, '/api/ideate-youtube-trends', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateNarration: (baseUrl: string, payload: GenerateNarrationRequest) =>
    requestJson<GenerateNarrationResponse>(baseUrl, '/api/generate-narration', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  composeScene: (baseUrl: string, payload: ComposeSceneRequest) =>
    requestJson<ComposeSceneResponse>(baseUrl, '/api/compose-scene', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  renderExperience: (baseUrl: string, payload: RenderExperienceRequest) =>
    requestJson<RenderExperienceResponse>(baseUrl, '/api/render-experience', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  uploadPersonaPhoto: async (baseUrl: string, file: File) => {
    const cleanBase = normalizeBaseUrl(baseUrl);
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${cleanBase}/api/upload-persona-photo`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const body = await res.text();
      let message = 'Failed to upload persona photo';
      try {
        const parsed = JSON.parse(body);
        if (typeof parsed?.detail === 'string') message = parsed.detail;
      } catch {
        // keep the generic message
      }
      throw new ApiClientError(message, res.status, body);
    }

    return (await res.json()) as PersonaPhotoUploadResponse;
  },
};

/** Browser-playable URL for a generated gs:// asset, streamed through the backend. */
export function mediaPreviewUrl(baseUrl: string, gsUri: string | null | undefined): string | null {
  if (!gsUri || !gsUri.startsWith('gs://')) return null;
  return `${normalizeBaseUrl(baseUrl)}/api/media?uri=${encodeURIComponent(gsUri)}`;
}

export function gsUriToHttpsPreviewUrl(gsUri: string | null | undefined): string | null {
  if (!gsUri || !gsUri.startsWith('gs://')) return null;
  const withoutScheme = gsUri.slice('gs://'.length);
  return `https://storage.googleapis.com/${withoutScheme}`;
}
