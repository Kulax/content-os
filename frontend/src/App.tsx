import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  Compass,
  Copy,
  Cpu,
  FileAudio,
  Film,
  Flame,
  Globe,
  Layers,
  Network,
  Play,
  RotateCcw,
  Sparkles,
  TrendingUp,
  User,
  Video,
  Wand2,
} from 'lucide-react';

import { TopNavbar, StudioMode } from './components/TopNavbar';
import { BlueprintCanvas } from './components/BlueprintCanvas';
import { TrendCanvas } from './components/TrendCanvas';
import { UnderstandingCanvas } from './components/UnderstandingCanvas';
import { ProductionCanvas } from './components/ProductionCanvas';
import { PresetSelect } from './components/PresetSelect';
import { RefineButton } from './components/RefineButton';

import {
  AdaptRequest,
  ComposeSceneRequest,
  ComposeSceneResponse,
  ContentBlueprint,
  ContentRecord,
  ContentSummary,
  ContentUnderstanding,
  CreateRequest,
  CreateVideoResponse,
  CreatorPersona,
  GenerateNarrationRequest,
  GenerateNarrationResponse,
  RenderExperienceRequest,
  RenderExperienceResponse,
  Scene,
  TransformRequest,
  TrendIdeationResponse,
  VideoJob,
  YouTubeTrendIdeationResponse,
} from './types/api';
import { ApiClientError, contentOsApi } from './services/apiClient';
import {
  API_BASE_URL,
  AUDIENCE_OPTIONS,
  CREATOR_ROLE_OPTIONS,
  LOCALIZATION_LANGUAGES,
  TONE_OPTIONS,
  YOUTUBE_CATEGORY_OPTIONS,
  YOUTUBE_REGION_OPTIONS,
} from './constants';

const VIDEO_JOB_POLL_MS = 4000;
const MAX_VIDEO_JOB_POLL_ERRORS = 5;
const HEALTH_RECHECK_MS = 30000;

export const App: React.FC = () => {
  // Runtime State
  const apiBaseUrl = API_BASE_URL;
  const [healthStatus, setHealthStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [gcpProject, setGcpProject] = useState<string | null>(null);

  // Active Workspace Mode
  const [activeMode, setActiveMode] = useState<StudioMode>('create');

  // Async Execution State
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [busyMessage, setBusyMessage] = useState<string>('');
  const [errorBanner, setErrorBanner] = useState<{ title: string; message: string; details?: any } | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Core Data States
  const [blueprint, setBlueprint] = useState<ContentBlueprint | null>(null);
  const [trendResult, setTrendResult] = useState<TrendIdeationResponse | null>(null);
  const [youtubeResult, setYoutubeResult] = useState<YouTubeTrendIdeationResponse | null>(null);
  const [understanding, setUnderstanding] = useState<ContentUnderstanding | null>(null);

  // Production Assets
  const [videoResult, setVideoResult] = useState<CreateVideoResponse | null>(null);
  const [videoJob, setVideoJob] = useState<VideoJob | null>(null);
  const [narrationResult, setNarrationResult] = useState<GenerateNarrationResponse | null>(null);
  const [composeResult, setComposeResult] = useState<ComposeSceneResponse | null>(null);
  const [renderResult, setRenderResult] = useState<RenderExperienceResponse | null>(null);

  // Form Controls State
  // 1. Create Form
  const [createPrompt, setCreatePrompt] = useState<string>(
    'Explain black holes for beginners in a cinematic 30-second experience.'
  );
  const [createAudience, setCreateAudience] = useState<string>('beginner');
  const [createDuration, setCreateDuration] = useState<number>(30);
  // Longest video the backend allows (spend guard on public deployments), from /health.
  const [maxVideoSeconds, setMaxVideoSeconds] = useState<number | null>(null);
  const [createLanguage, setCreateLanguage] = useState<string>('English');
  // Extra dubbed languages; none by default because each one adds processing time.
  const [targetLanguages, setTargetLanguages] = useState<string[]>([]);
  const [createTone, setCreateTone] = useState<string>('engaging');
  const [visualStyle, setVisualStyle] = useState<string>('Cinematic Realistic');
  const [captionsEnabled, setCaptionsEnabled] = useState<boolean>(true);

  // Creator Persona / Digital Twin Controls
  const [enableCreatorPersona, setEnableCreatorPersona] = useState<boolean>(true);
  const [creatorName, setCreatorName] = useState<string>('Alex Chen');
  const [creatorRole, setCreatorRole] = useState<string>('Tech & Innovation Host');
  const [creatorVisualDesc, setCreatorVisualDesc] = useState<string>(
    'Mid-20s tech creator wearing clean black minimalist jacket, direct eye contact with camera, soft cinematic studio backlight.'
  );
  const [creatorPresentationMode, setCreatorPresentationMode] = useState<
    'on_camera_host' | 'voiceover_with_avatar' | 'reaction_commentary' | 'b_roll_focused'
  >('on_camera_host');
  const [creatorPhotoPreview, setCreatorPhotoPreview] = useState<string | null>(null);
  const [creatorPhotoUri, setCreatorPhotoUri] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);

  // 2. Trend Ideation Form
  const [ytCategory, setYtCategory] = useState<string>('education');
  const [ytRegion, setYtRegion] = useState<string>('US');
  const [trendTopic, setTrendTopic] = useState<string>('');
  const [trendContext, setTrendContext] = useState<string>('');

  // 3. Transform Form
  const [transformSource, setTransformSource] = useState<string>(
    'Quantum computers exploit the unique behavior of quantum mechanics—such as superposition and entanglement—to perform calculations that would be intractable for classical machines. While classical bits store 0 or 1, qubits can represent combinations of both.'
  );
  const [transformGoal, setTransformGoal] = useState<string>(
    'Convert this into a concise visual lesson for high school learners.'
  );

  // 4. Understand Form
  const [understandText, setUnderstandText] = useState<string>(
    'Photosynthesis is the process used by plants, algae, and certain bacteria to convert light energy into chemical energy stored in glucose molecules. Water and carbon dioxide are consumed, releasing oxygen as a byproduct.'
  );

  // 5. Adapt Form
  const [adaptBasePrompt, setAdaptBasePrompt] = useState<string>(
    'Explain black holes for beginners in a cinematic 30-second experience.'
  );
  const [adaptInstruction, setAdaptInstruction] = useState<string>(
    'Make it simpler for a 12-year-old and reduce to 90 seconds.'
  );
  const [adaptContentId, setAdaptContentId] = useState<string>('');
  const [adaptVersion, setAdaptVersion] = useState<number>(1);
  const [knownContentIds, setKnownContentIds] = useState<ContentSummary[]>([]);
  // Highest version number with files in the bucket, per content ID (from the last Load).
  const [latestStoredVersions, setLatestStoredVersions] = useState<Record<string, number>>({});

  // 6. Media & Render Studio Form
  const [composeContentId, setComposeContentId] = useState<string>('');
  const [composeSceneNumber, setComposeSceneNumber] = useState<number>(1);
  const [composeShotUris, setComposeShotUris] = useState<string>('');

  const [renderContentId, setRenderContentId] = useState<string>('');
  const [renderSceneUris, setRenderSceneUris] = useState<string>('');
  const [renderNarrationUri, setRenderNarrationUri] = useState<string>('');


  // Ping Backend Health (quietly re-checked so the status recovers after a backend restart)
  const checkHealth = async (silent = false) => {
    if (!silent) setHealthStatus('checking');
    try {
      const res = await contentOsApi.checkHealth(apiBaseUrl);
      setHealthStatus('online');
      setGcpProject(res.project || 'Configured');
      if (res.max_video_seconds) {
        setMaxVideoSeconds(res.max_video_seconds);
        setCreateDuration((current) => Math.min(current, res.max_video_seconds!));
      }
    } catch {
      setHealthStatus('offline');
      setGcpProject(null);
    }
  };

  useEffect(() => {
    checkHealth();
    const timer = window.setInterval(() => checkHealth(true), HEALTH_RECHECK_MS);
    return () => window.clearInterval(timer);
  }, [apiBaseUrl]);

  // Suggest existing content IDs from the output bucket when opening Transform & Adapt.
  useEffect(() => {
    if (activeMode !== 'transform') return;
    contentOsApi
      .listContent(apiBaseUrl)
      .then(setKnownContentIds)
      .catch(() => setKnownContentIds([]));
  }, [activeMode, apiBaseUrl]);

  // Unified Error / Success notification dispatcher
  const notifySuccess = (msg: string) => {
    setSuccessBanner(msg);
    setErrorBanner(null);
    setTimeout(() => setSuccessBanner(null), 6000);
  };

  const notifyError = (title: string, err: unknown) => {
    console.error(title, err);
    setSuccessBanner(null);
    if (err instanceof ApiClientError) {
      setErrorBanner({
        title,
        message: err.message,
        details: err.details,
      });
    } else {
      setErrorBanner({
        title,
        message: (err as any)?.message || 'An unexpected error occurred.',
      });
    }
  };

  const getActiveCreatorPersona = (): CreatorPersona | null => {
    if (!enableCreatorPersona) return null;
    return {
      name: creatorName.trim() || 'Creator',
      role_title: creatorRole.trim() || 'Host / Presenter',
      visual_description: creatorVisualDesc.trim(),
      voice_tone: 'charismatic, clear, and natural',
      presentation_mode: creatorPresentationMode,
      reference_image_uri: creatorPhotoUri || null,
    };
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local instant preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setCreatorPhotoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to backend
    setIsUploadingPhoto(true);
    setCreatorPhotoUri(null);
    try {
      const res = await contentOsApi.uploadPersonaPhoto(apiBaseUrl, file);
      // Veo reads the reference photo from Cloud Storage; fall back to the local upload path.
      setCreatorPhotoUri(res.gcs_uri || res.url);
      notifySuccess(`Persona reference photo "${file.name}" uploaded successfully for visual conditioning.`);
    } catch (err) {
      notifyError('Failed to upload persona reference photo', err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // -------------------------------------------------------------
  // ACTION HANDLERS
  // -------------------------------------------------------------

  // 1. Create Blueprint
  const handleCreateBlueprint = async (overrideRequest?: CreateRequest) => {
    setIsBusy(true);
    setBusyMessage('Synthesizing structured Content DNA, creator roadmap, and multilingual shot planning...');
    setErrorBanner(null);

    const targetPrompt = (overrideRequest?.prompt ?? createPrompt).trim();
    const duration = Math.max(Number(overrideRequest?.duration_seconds ?? createDuration) || 120, 4);

    const payload: CreateRequest = {
      prompt: targetPrompt,
      audience_level: (overrideRequest?.audience_level ?? createAudience).trim() || 'general',
      duration_seconds: duration,
      language: (overrideRequest?.language ?? createLanguage).trim() || 'English',
      // Only the languages picked in the form become extra dubbed versions.
      target_languages: targetLanguages,
      creator_persona:
        overrideRequest?.creator_persona !== undefined
          ? overrideRequest.creator_persona
          : getActiveCreatorPersona(),
      visual_style: overrideRequest?.visual_style || visualStyle,
      format: overrideRequest?.format || 'video',
      tone: (overrideRequest?.tone ?? createTone).trim() || 'engaging',
    };

    try {
      const result = await contentOsApi.createBlueprint(apiBaseUrl, payload);
      setBlueprint(result);
      setAdaptBasePrompt(payload.prompt);
      setAdaptContentId(result.content_id);
      setAdaptVersion(result.version);
      setComposeContentId(result.content_id);
      setRenderContentId(result.content_id);
      notifySuccess(`Content DNA Blueprint created with actionable creator roadmap (ID: ${result.content_id}, v${result.version}).`);
    } catch (err) {
      notifyError('Failed to generate Content DNA', err);
    } finally {
      setIsBusy(false);
    }
  };

  // Builds a CreateRequest from the Create form (persona, style, captions...), with optional overrides.
  const buildCreatePayload = (overrideRequest?: CreateRequest): CreateRequest => {
    const targetPrompt = (overrideRequest?.prompt ?? createPrompt).trim();
    const duration = Math.max(Number(overrideRequest?.duration_seconds ?? createDuration) || 120, 4);

    return {
      prompt: targetPrompt,
      audience_level: (overrideRequest?.audience_level ?? createAudience).trim() || 'general',
      duration_seconds: duration,
      language: (overrideRequest?.language ?? createLanguage).trim() || 'English',
      // Only the languages picked in the form become extra dubbed versions.
      target_languages: targetLanguages,
      creator_persona:
        overrideRequest?.creator_persona !== undefined
          ? overrideRequest.creator_persona
          : getActiveCreatorPersona(),
      visual_style: overrideRequest?.visual_style || visualStyle,
      format: overrideRequest?.format || 'video',
      tone: (overrideRequest?.tone ?? createTone).trim() || 'engaging',
      captions_enabled: overrideRequest?.captions_enabled ?? captionsEnabled,
    };
  };

  // Starts a background video job and polls it so finished scenes appear in the live preview.
  const runVideoJob = async (startJob: () => Promise<VideoJob>, busyMessageText: string) => {
    setIsBusy(true);
    setBusyMessage(busyMessageText);
    setErrorBanner(null);

    try {
      const startedJob = await startJob();
      setVideoJob(startedJob);
      setVideoResult(null);
      setActiveMode('production');

      let job = startedJob;
      let consecutivePollErrors = 0;
      while (job.status === 'queued' || job.status === 'running') {
        await new Promise((resolve) => setTimeout(resolve, VIDEO_JOB_POLL_MS));
        try {
          job = await contentOsApi.getVideoJob(apiBaseUrl, startedJob.job_id);
          consecutivePollErrors = 0;
          setVideoJob(job);
          setBusyMessage(job.message);
        } catch (pollErr) {
          consecutivePollErrors += 1;
          if (consecutivePollErrors >= MAX_VIDEO_JOB_POLL_ERRORS) throw pollErr;
        }
      }

      if (job.status === 'failed' || !job.result) {
        throw new Error(job.error || 'Video generation failed.');
      }

      const result = job.result;
      setVideoResult(result);
      setRenderContentId(result.content_id);
      setLatestStoredVersions((prev) => ({
        ...prev,
        [result.content_id]: Math.max(prev[result.content_id] ?? 0, result.version),
      }));

      // Keep the DNA view and adapt controls in sync with the version that was rendered.
      if (result.blueprint) {
        setBlueprint(result.blueprint);
        setAdaptContentId(result.blueprint.content_id);
        setAdaptVersion(result.blueprint.version);
        setComposeContentId(result.blueprint.content_id);
      }

      const scenePath =
        result.captioned_scene_video_path || result.narrated_scene_video_path || result.scene_video_path;
      if (scenePath) {
        setRenderSceneUris(scenePath);
      }
      if (result.narration_audio_uri) {
        setRenderNarrationUri(result.narration_audio_uri);
      }

      notifySuccess(
        `Video v${result.version} ready: ${result.total_scenes ?? result.scenes?.length ?? 1} scene(s)` +
          (result.face_reference_used ? ' featuring your reference photo.' : '.')
      );
    } catch (err) {
      notifyError('Failed to generate Video', err);
    } finally {
      setIsBusy(false);
    }
  };

  // 2. Create Video + Narration
  const handleCreateVideo = async (overrideRequest?: CreateRequest) => {
    const payload = buildCreatePayload(overrideRequest);
    await runVideoJob(
      () => contentOsApi.startVideoJob(apiBaseUrl, payload),
      'Generating Veo shot assets, subject conditioning, and cloud narration...'
    );
  };

  // Render the currently loaded Content DNA version (e.g. after Transform or Adapt) without regenerating it.
  const handleGenerateVideoFromBlueprint = async () => {
    if (!blueprint) return;
    const options: CreateRequest = {
      ...buildCreatePayload(),
      prompt: blueprint.title || createPrompt,
      duration_seconds: blueprint.target_duration_seconds || createDuration,
    };
    await runVideoJob(
      () => contentOsApi.startBlueprintVideoJob(apiBaseUrl, { blueprint, options }),
      `Rendering Content DNA v${blueprint.version} as video...`
    );
  };

  // 3. YouTube Category Trends Fetch
  const handleFetchYouTubeTrends = async () => {
    setIsBusy(true);
    setBusyMessage(`Fetching trending videos for "${ytCategory.toUpperCase()}" (${ytRegion}) and extracting creator angles...`);
    setErrorBanner(null);

    try {
      const result = await contentOsApi.ideateYouTubeTrends(apiBaseUrl, {
        category: ytCategory,
        region_code: ytRegion.trim().toUpperCase() || 'US',
        max_results: 12,
        audience_level: createAudience || 'general',
        language: createLanguage || 'English',
        max_ideas: 4,
        topic_override: trendTopic.trim() || null,
        additional_context: trendContext.trim() || null,
      });

      setYoutubeResult(result);
      setTrendResult(result.ideation);
      notifySuccess(`Fetched ${result.fetched_count} trending videos and synthesized ${result.ideation?.ideas?.length || 0} actionable content angles.`);
    } catch (err) {
      notifyError('YouTube Trend Ideation failed', err);
    } finally {
      setIsBusy(false);
    }
  };

  // 5. Load Idea from Trend Radar into Create
  const handleLoadIdeaIntoCreate = (req: CreateRequest, autoAction?: 'dna' | 'video') => {
    setCreatePrompt(req.prompt);
    setCreateAudience(req.audience_level || 'general');
    setCreateDuration(req.duration_seconds || 120);
    setCreateLanguage(req.language || 'English');
    setCreateTone(req.tone || 'engaging');
    if (req.creator_persona) {
      setEnableCreatorPersona(true);
      setCreatorName(req.creator_persona.name || 'Alex Chen');
      setCreatorRole(req.creator_persona.role_title || 'Host / Presenter');
    }
    setActiveMode('create');

    notifySuccess('Trend concept loaded into Creator Studio.');

    if (autoAction === 'dna') {
      handleCreateBlueprint(req);
    } else if (autoAction === 'video') {
      handleCreateVideo(req);
    }
  };

  // 6. Transform Source Material
  const handleTransform = async () => {
    setIsBusy(true);
    setBusyMessage('Transforming source content into a cinematic Content Blueprint...');
    setErrorBanner(null);

    const payload: TransformRequest = {
      source_text: transformSource.trim(),
      transform_goal: transformGoal.trim(),
      audience_level: createAudience || 'general',
      duration_seconds: Number(createDuration) || 120,
      language: createLanguage || 'English',
      format: 'video',
      tone: createTone || 'engaging',
    };

    try {
      const result = await contentOsApi.transformContent(apiBaseUrl, payload);
      setBlueprint(result);
      setAdaptBasePrompt(transformGoal);
      setAdaptContentId(result.content_id);
      setAdaptVersion(result.version);
      setComposeContentId(result.content_id);
      setRenderContentId(result.content_id);
      setActiveMode('create');
      notifySuccess(`Transformed source into Content DNA Blueprint (ID: ${result.content_id}).`);
    } catch (err) {
      notifyError('Transformation failed', err);
    } finally {
      setIsBusy(false);
    }
  };

  // 7. Adapt Intent
  // The loaded DNA is only the adaptation base if it belongs to the content ID in the form;
  // otherwise the backend loads (or rebuilds) the saved DNA for that content ID.
  const typedAdaptContentId = adaptContentId.trim();
  const loadedDnaMatchesAdaptId =
    !!blueprint && (!typedAdaptContentId || typedAdaptContentId === blueprint.content_id);

  const buildAdaptPayload = (overrideInstruction?: string): AdaptRequest => ({
    base_request: {
      ...buildCreatePayload(),
      prompt: loadedDnaMatchesAdaptId
        ? `${blueprint!.title}: ${blueprint!.one_line_concept}`
        : typedAdaptContentId
        ? `Existing content ${typedAdaptContentId}`
        : adaptBasePrompt.trim() || createPrompt.trim(),
    },
    adaptation_instruction: (overrideInstruction || adaptInstruction).trim(),
    content_id: typedAdaptContentId || blueprint?.content_id || null,
    current_version: loadedDnaMatchesAdaptId ? blueprint!.version : adaptVersion || 1,
    base_blueprint: loadedDnaMatchesAdaptId ? blueprint : null,
  });

  const handleLoadContent = async (contentIdToLoad?: string) => {
    const contentId = (contentIdToLoad ?? adaptContentId).trim();
    if (!contentId) return;

    setIsBusy(true);
    setBusyMessage(`Loading content "${contentId}" (rebuilding its Content DNA from the video if it was never saved)...`);
    setErrorBanner(null);

    try {
      const record: ContentRecord = await contentOsApi.getContent(apiBaseUrl, contentId);
      setLatestStoredVersions((prev) => ({ ...prev, [record.content_id]: record.latest_version }));
      setBlueprint(record.blueprint);
      setAdaptContentId(record.content_id);
      setAdaptVersion(record.version);
      setAdaptBasePrompt(`${record.blueprint.title}: ${record.blueprint.one_line_concept}`);
      setComposeContentId(record.content_id);
      setRenderContentId(record.content_id);
      setVideoJob(null);
      // Attach the plan so the preview knows the primary language and title.
      setVideoResult(record.video_result ? { ...record.video_result, blueprint: record.blueprint } : null);
      notifySuccess(
        `Loaded "${record.blueprint.title}" (${record.content_id} v${record.version}` +
          (record.versions.length > 1 ? `, versions: ${record.versions.map((v) => `v${v}`).join(', ')}` : '') +
          ')' +
          (record.recovered ? '. Its Content DNA was rebuilt from the video and saved.' : '.')
      );
    } catch (err) {
      notifyError(`Could not load content "${contentId}"`, err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleAdapt = async (overrideInstruction?: string) => {
    setIsBusy(true);
    setBusyMessage('Adapting Content DNA while preserving semantic core...');
    setErrorBanner(null);

    const payload = buildAdaptPayload(overrideInstruction);

    try {
      const result = await contentOsApi.adaptContent(apiBaseUrl, payload);
      setBlueprint(result);
      setAdaptContentId(result.content_id);
      setAdaptVersion(result.version);
      setLatestStoredVersions((prev) => ({
        ...prev,
        [result.content_id]: Math.max(prev[result.content_id] ?? 0, result.version),
      }));
      setComposeContentId(result.content_id);
      setRenderContentId(result.content_id);
      setActiveMode('create');
      notifySuccess(`Adapted Content DNA to version ${result.version} (ID: ${result.content_id}).`);
    } catch (err) {
      notifyError('Adaptation failed', err);
    } finally {
      setIsBusy(false);
    }
  };

  // Adapt the DNA to the next version and render that version as a new video.
  const handleAdaptVideo = async (overrideInstruction?: string) => {
    const payload = buildAdaptPayload(overrideInstruction);
    const target = payload.content_id ? `"${payload.content_id}"` : 'the Create prompt';
    await runVideoJob(
      () => contentOsApi.startAdaptVideoJob(apiBaseUrl, payload),
      `Adapting ${target} to its next version and rendering the new video...`
    );
  };

  // Re-narrate an existing version with another voice, reusing its footage.
  const handleRevoice = async (contentId: string, version: number, gender: 'male' | 'female') => {
    await runVideoJob(
      () =>
        contentOsApi.startRevoiceJob(apiBaseUrl, contentId, {
          version,
          voice_gender: gender,
          captions_enabled: captionsEnabled,
        }),
      `Re-voicing ${contentId} v${version} with a ${gender} narrator...`
    );
  };

  // Add a dubbed language version to an existing video, reusing its footage.
  const handleLocalize = async (contentId: string, version: number, language: string) => {
    await runVideoJob(
      () =>
        contentOsApi.startLocalizeJob(apiBaseUrl, contentId, {
          version,
          languages: [language],
          captions_enabled: captionsEnabled,
        }),
      `Creating the ${language} version of ${contentId} v${version}...`
    );
  };

  // 8. Analyze Semantics (Understand)
  const handleUnderstand = async () => {
    setIsBusy(true);
    setBusyMessage('Extracting concepts, relationships, and claims with calibrated confidence...');
    setErrorBanner(null);

    try {
      const result = await contentOsApi.understandContent(apiBaseUrl, {
        content_text: understandText.trim(),
        audience_level: createAudience || 'general',
      });
      setUnderstanding(result);
      notifySuccess(`Semantic knowledge graph generated (${result.concepts?.length || 0} concepts, ${result.claims?.length || 0} claims).`);
    } catch (err) {
      notifyError('Semantic understanding failed', err);
    } finally {
      setIsBusy(false);
    }
  };

  // 9. Generate Single Scene Narration
  const handleGenerateSceneNarration = async (scene: Scene) => {
    setIsBusy(true);
    setBusyMessage(`Synthesizing Cloud TTS audio for Scene ${scene.scene_number}...`);
    setErrorBanner(null);

    const payload: GenerateNarrationRequest = {
      content_id: blueprint?.content_id || `content_${Date.now().toString(16)}`,
      text: scene.narration,
      language_code: createLanguage === 'Spanish' ? 'es-ES' : 'en-US',
      speaking_rate: 1.0,
      scene_number: scene.scene_number,
    };

    try {
      const result = await contentOsApi.generateNarration(apiBaseUrl, payload);
      setNarrationResult(result);
      setRenderNarrationUri(result.audio_uri);
      setActiveMode('production');
      notifySuccess(`Narration synthesized for Scene ${scene.scene_number}.`);
    } catch (err) {
      notifyError(`Scene ${scene.scene_number} Narration failed`, err);
    } finally {
      setIsBusy(false);
    }
  };

  // 10. Compose Scene Shots
  const handleComposeScene = async () => {
    setIsBusy(true);
    setBusyMessage(`Composing shot clips for Scene ${composeSceneNumber}...`);
    setErrorBanner(null);

    const uris = composeShotUris
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: ComposeSceneRequest = {
      content_id: composeContentId.trim() || blueprint?.content_id || 'content_demo',
      scene_number: composeSceneNumber,
      shot_uris: uris,
    };

    try {
      const result = await contentOsApi.composeScene(apiBaseUrl, payload);
      setComposeResult(result);
      if (result.scene_video_path) {
        setRenderSceneUris((prev) => (prev ? `${prev}\n${result.scene_video_path}` : result.scene_video_path!));
      }
      notifySuccess(`Scene ${composeSceneNumber} composition status: ${result.composition_status}`);
    } catch (err) {
      notifyError('Scene composition failed', err);
    } finally {
      setIsBusy(false);
    }
  };

  // 11. Render Final Experience
  const handleRenderExperience = async () => {
    setIsBusy(true);
    setBusyMessage('Stitching scene videos and muxing master narration audio via FFmpeg...');
    setErrorBanner(null);

    const uris = renderSceneUris
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: RenderExperienceRequest = {
      content_id: renderContentId.trim() || blueprint?.content_id || 'content_demo',
      scene_uris: uris,
      narration_audio_uri: renderNarrationUri.trim() || null,
      subtitle_cues: [],
    };

    try {
      const result = await contentOsApi.renderExperience(apiBaseUrl, payload);
      setRenderResult(result);
      notifySuccess(`Final master render status: ${result.render_status}`);
    } catch (err) {
      notifyError('Final render failed', err);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="studio-shell">
      <div className="studio-backdrop" aria-hidden="true" />
      <div className="studio-grid-overlay" aria-hidden="true" />

      {/* Global Topbar */}
      <TopNavbar
        activeMode={activeMode}
        onSelectMode={(mode) => setActiveMode(mode)}
        healthStatus={healthStatus}
        gcpProject={gcpProject}
      />

      {/* Main Studio Workspace */}
      <main className="workspace-container">
        {/* LEFT COLUMN: Controls & Prompt Studio */}
        <div className="left-column">
          {/* Universal Settings Bar */}
          <section className="surface-card">
            <div className="card-header" style={{ marginBottom: '0.65rem' }}>
              <div className="card-title-group">
                <span className="card-kicker">EXPERIENCE PARAMETERS</span>
                <h3 className="card-title" style={{ fontSize: '1.05rem' }}>
                  Audience & Format Settings
                </h3>
              </div>
            </div>

            <div className="field-row-2">
              <div className="field-group">
                <label className="field-label" htmlFor="inpAudience">
                  Audience Level
                </label>
                <PresetSelect
                  id="inpAudience"
                  value={createAudience}
                  onChange={setCreateAudience}
                  options={AUDIENCE_OPTIONS}
                  customPlaceholder="e.g. new parents, B2B marketers"
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="inpDuration">
                  <span>Target Duration (s)</span>
                  {maxVideoSeconds && <span className="field-hint">max {maxVideoSeconds}s</span>}
                </label>
                <input
                  id="inpDuration"
                  type="number"
                  className="studio-input"
                  min={8}
                  max={maxVideoSeconds ?? 3600}
                  value={createDuration}
                  onChange={(e) => setCreateDuration(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="field-row-2">
              <div className="field-group">
                <label className="field-label" htmlFor="inpLanguage">
                  Primary Language
                </label>
                <select
                  id="inpLanguage"
                  className="studio-select"
                  value={createLanguage}
                  onChange={(e) => setCreateLanguage(e.target.value)}
                >
                  <option value="English">English (en-US)</option>
                  <option value="Spanish">Spanish (es-ES)</option>
                  <option value="Hindi">Hindi (hi-IN)</option>
                  <option value="French">French (fr-FR)</option>
                  <option value="German">German (de-DE)</option>
                  <option value="Japanese">Japanese (ja-JP)</option>
                  <option value="Portuguese">Portuguese (pt-BR)</option>
                </select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="inpTone">
                  Tone
                </label>
                <PresetSelect
                  id="inpTone"
                  value={createTone}
                  onChange={setCreateTone}
                  options={TONE_OPTIONS}
                  customPlaceholder="e.g. playful but precise"
                />
              </div>
            </div>

            {/* Multilingual Multi-target Tags */}
            <div style={{ marginTop: '0.45rem' }}>
              <div className="field-label" style={{ marginBottom: '0.25rem' }}>
                <span>
                  <Globe size={11} style={{ display: 'inline', marginRight: 4 }} />
                  Multilingual Localization Targets
                </span>
                <span className="field-hint">Extra dubbed versions of the same video</span>
              </div>
              <div className="chip-row">
                {LOCALIZATION_LANGUAGES.map((lang) => {
                  const isPrimary = lang === createLanguage;
                  const isSelected = !isPrimary && targetLanguages.includes(lang);
                  return (
                    <button
                      key={lang}
                      type="button"
                      className={`preset-chip ${isSelected || isPrimary ? 'active' : ''}`}
                      disabled={isPrimary}
                      title={isPrimary ? 'Primary language: the main video is narrated in it' : undefined}
                      onClick={() => {
                        if (isSelected) {
                          setTargetLanguages(targetLanguages.filter((l) => l !== lang));
                        } else {
                          setTargetLanguages([...targetLanguages, lang]);
                        }
                      }}
                    >
                      {lang} {isPrimary ? '(primary)' : isSelected ? '✓' : '+'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visual Style & Animation Aesthetics */}
            <div style={{ marginTop: '0.65rem' }}>
              <div className="field-group" style={{ marginBottom: '0.35rem' }}>
                <label className="field-label" htmlFor="selVisualStyle">
                  <span>
                    <Film size={11} style={{ display: 'inline', marginRight: 4 }} />
                    Visual Style / Animation Type
                  </span>
                  <span className="field-hint">Veo rendering aesthetic</span>
                </label>
                <select
                  id="selVisualStyle"
                  className="studio-select"
                  value={visualStyle}
                  onChange={(e) => setVisualStyle(e.target.value)}
                >
                  <option value="Cinematic Realistic">Cinematic Realistic (4K Photoreal)</option>
                  <option value="Pastel / Wes Anderson">Pastel / Wes Anderson (Symmetrical & Muted)</option>
                  <option value="Pulp / Neo-Noir">Pulp / Neo-Noir (High Contrast & Neon Gritty)</option>
                  <option value="90s Multi-Cam Sitcom">90s Multi-Cam Sitcom (NTSC Broadcast Studio)</option>
                  <option value="3D Pixar / Animation">3D Pixar / Dreamworks Animation</option>
                  <option value="2D Anime / Cartoon">2D Anime / Studio Ghibli Cartoon</option>
                  <option value="Cyberpunk / Sci-Fi">Cyberpunk / Neon Sci-Fi</option>
                  <option value="Claymation / Stop-Motion">Claymation / Stop-Motion (Tactile)</option>
                  <option value="Watercolor / Storybook">Watercolor / Storybook Illustration</option>
                  <option value="Retro 80s VHS">Retro 80s VHS / Analog Film</option>
                </select>
              </div>

              <div className="chip-row">
                {[
                  'Pastel (Anderson)',
                  'Pulp Noir',
                  '90s Sitcom',
                  '3D Pixar',
                  '2D Anime',
                  'Photoreal',
                  'Cyberpunk',
                  'Claymation',
                  'Watercolor',
                  'Retro VHS',
                ].map((s) => {
                  const fullVal =
                    s === 'Pastel (Anderson)'
                      ? 'Pastel / Wes Anderson'
                      : s === 'Pulp Noir'
                      ? 'Pulp / Neo-Noir'
                      : s === '90s Sitcom'
                      ? '90s Multi-Cam Sitcom'
                      : s === '3D Pixar'
                      ? '3D Pixar / Animation'
                      : s === '2D Anime'
                      ? '2D Anime / Cartoon'
                      : s === 'Photoreal'
                      ? 'Cinematic Realistic'
                      : s === 'Cyberpunk'
                      ? 'Cyberpunk / Sci-Fi'
                      : s === 'Claymation'
                      ? 'Claymation / Stop-Motion'
                      : s === 'Watercolor'
                      ? 'Watercolor / Storybook'
                      : 'Retro 80s VHS';
                  const isActive = visualStyle === fullVal;
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`preset-chip ${isActive ? 'active' : ''}`}
                      onClick={() => setVisualStyle(fullVal)}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>

              <label
                htmlFor="chkCaptions"
                className="field-label"
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '0.65rem', cursor: 'pointer' }}
              >
                <input
                  id="chkCaptions"
                  type="checkbox"
                  className="studio-checkbox"
                  checked={captionsEnabled}
                  onChange={(e) => setCaptionsEnabled(e.target.checked)}
                />
                <span>Burn-in captions</span>
                <span className="field-hint">Narration subtitles rendered into generated videos</span>
              </label>
            </div>
          </section>

          {/* Digital Twin / Creator Persona Card */}
          <section
            className="surface-card"
            style={{
              borderColor: enableCreatorPersona ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-subtle)',
              background: enableCreatorPersona
                ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.05) 0%, var(--bg-panel) 120px)'
                : 'var(--bg-panel)',
            }}
          >
            <div
              className="card-header"
              style={{ marginBottom: '0.5rem', cursor: 'pointer' }}
              onClick={() => setEnableCreatorPersona(!enableCreatorPersona)}
            >
              <div className="card-title-group">
                <span className="card-kicker" style={{ color: '#34d399' }}>
                  GOOGLE AI DIGITAL TWIN & PERSONA
                </span>
                <h3 className="card-title" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={16} /> Feature Myself / Creator Identity
                </h3>
              </div>
              <input
                type="checkbox"
                className="studio-checkbox emerald"
                aria-label="Feature myself in the video"
                checked={enableCreatorPersona}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEnableCreatorPersona(e.target.checked)}
              />
            </div>

            {enableCreatorPersona && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.4rem' }}>
                <div className="field-row-2">
                  <div className="field-group">
                    <label className="field-label" htmlFor="inpCreatorName">
                      Creator Name
                    </label>
                    <input
                      id="inpCreatorName"
                      type="text"
                      className="studio-input"
                      value={creatorName}
                      onChange={(e) => setCreatorName(e.target.value)}
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="inpCreatorRole">
                      Role / Show Format
                    </label>
                    <PresetSelect
                      id="inpCreatorRole"
                      value={creatorRole}
                      onChange={setCreatorRole}
                      options={CREATOR_ROLE_OPTIONS}
                      customPlaceholder="e.g. Street food reviewer"
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="selCreatorMode">
                    Presentation Mode
                  </label>
                  <select
                    id="selCreatorMode"
                    className="studio-select"
                    value={creatorPresentationMode}
                    onChange={(e) => setCreatorPresentationMode(e.target.value as any)}
                  >
                    <option value="on_camera_host">On-Camera Host (Direct to Camera)</option>
                    <option value="reaction_commentary">Reaction / Commentary (Side by Side)</option>
                    <option value="voiceover_with_avatar">Voiceover + Avatar Hook Cameos</option>
                    <option value="b_roll_focused">Cinematic B-Roll Focused</option>
                  </select>
                </div>

                <div className="field-group">
                  <div className="field-label">
                    <label htmlFor="inpCreatorVisual">Visual Anchor & Outfit Description (Veo Conditioning)</label>
                    <RefineButton
                      apiBaseUrl={apiBaseUrl}
                      field="visual_anchor"
                      value={creatorVisualDesc}
                      onChange={setCreatorVisualDesc}
                      disabled={isBusy}
                      context={{
                        role: creatorRole,
                        presentation_mode: creatorPresentationMode,
                        visual_style: visualStyle,
                        reference_photo: creatorPhotoUri ? 'yes, the uploaded photo defines the face' : 'no',
                      }}
                    />
                  </div>
                  <textarea
                    id="inpCreatorVisual"
                    className="studio-textarea"
                    rows={2}
                    value={creatorVisualDesc}
                    onChange={(e) => setCreatorVisualDesc(e.target.value)}
                    placeholder="e.g. Mid-20s creator in dark hoodie, warm neon studio lighting, looking directly at lens."
                  />
                </div>

                {/* Creator Reference Photo Uploader */}
                <div
                  className="scene-box"
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderColor: creatorPhotoPreview ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-subtle)',
                    padding: '0.65rem 0.8rem',
                  }}
                >
                  <div className="scene-box-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Reference Headshot / Photo (Veo Subject Anchor)</span>
                    {isUploadingPhoto && <span style={{ color: '#fbbf24' }}>Uploading...</span>}
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.35rem' }}>
                    {creatorPhotoPreview ? (
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid var(--accent-emerald)',
                          flexShrink: 0,
                        }}
                      >
                        <img
                          src={creatorPhotoPreview}
                          alt="Creator preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '8px',
                          background: 'var(--bg-elevated)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px dashed var(--border-subtle)',
                          color: 'var(--text-muted)',
                          flexShrink: 0,
                        }}
                      >
                        <User size={20} />
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        id="creatorPhotoInput"
                        onChange={handlePhotoUpload}
                        style={{ display: 'none' }}
                      />
                      <label
                        htmlFor="creatorPhotoInput"
                        className="btn btn-secondary btn-sm"
                        style={{ alignSelf: 'flex-start', cursor: 'pointer' }}
                      >
                        {creatorPhotoPreview ? 'Change Photo' : 'Upload Headshot Photo'}
                      </label>
                      <span className="field-hint" style={{ fontSize: '0.68rem' }}>
                        {creatorPhotoUri
                          ? '✓ Your face is used as a Veo reference (host shots render as 8s clips)'
                          : 'Upload 1 clear, front-facing photo (PNG/JPEG/WebP) to feature your face'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* MODE SPECIFIC CONTROL PANELS */}
          {activeMode === 'create' && (
            <section className="surface-card highlighted">
              <div className="card-header">
                <div className="card-title-group">
                  <span className="card-kicker">CREATOR PROMPT COMPOSER</span>
                  <h2 className="card-title">What do you want to create?</h2>
                  <p className="card-subtitle">
                    Gemini designs full Content DNA; Veo generates cinematic shot plans.
                  </p>
                </div>
              </div>

              <div className="field-group">
                <div className="field-label">
                  <label htmlFor="inpPrompt">Communication Goal / Narrative Brief</label>
                  <RefineButton
                    apiBaseUrl={apiBaseUrl}
                    field="creator_prompt"
                    value={createPrompt}
                    onChange={setCreatePrompt}
                    disabled={isBusy}
                    context={{
                      audience: createAudience,
                      tone: createTone,
                      duration_seconds: createDuration,
                      language: createLanguage,
                      visual_style: visualStyle,
                      host_role: enableCreatorPersona ? creatorRole : null,
                    }}
                  />
                </div>
                <textarea
                  id="inpPrompt"
                  className="studio-textarea"
                  rows={5}
                  value={createPrompt}
                  onChange={(e) => setCreatePrompt(e.target.value)}
                  placeholder="Describe your topic, narrative goal, or visual vision..."
                />
              </div>

              <div className="chip-row" style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() =>
                    setCreatePrompt(
                      'Explain black holes for beginners in a cinematic 30-second experience.'
                    )
                  }
                >
                  Black Holes
                </button>
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() =>
                    setCreatePrompt(
                      'How semiconductors work for high school students with physical analogies.'
                    )
                  }
                >
                  Semiconductors
                </button>
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() =>
                    setCreatePrompt(
                      'Explain the economics of supply chain inflation in 60 seconds.'
                    )
                  }
                >
                  Supply Chains
                </button>
              </div>

              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isBusy || createPrompt.trim().length < 3}
                  onClick={() => handleCreateBlueprint()}
                >
                  <Sparkles size={14} /> Create Content DNA
                </button>

                <button
                  type="button"
                  className="btn btn-cyan"
                  disabled={isBusy || createPrompt.trim().length < 3}
                  onClick={() => handleCreateVideo()}
                >
                  <Video size={14} /> Create Video + Narration
                </button>
              </div>
            </section>
          )}

          {activeMode === 'trends' && (
            <section className="surface-card highlighted">
              <div className="card-header">
                <div className="card-title-group">
                  <span className="card-kicker">TREND RADAR & DISCOVERY</span>
                  <h2 className="card-title">YouTube Trending & Signal Ingestion</h2>
                  <p className="card-subtitle">
                    Fetch live YouTube trends by category and region.
                  </p>
                </div>
              </div>

              {/* Direct YouTube Fetch Card */}
              <div className="scene-box" style={{ marginBottom: '1rem' }}>
                <div className="scene-box-label" style={{ color: '#38bdf8' }}>
                  <Flame size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Direct YouTube Category Feed
                </div>

                <div className="field-row-2" style={{ marginTop: '0.4rem' }}>
                  <div className="field-group">
                    <label className="field-label" htmlFor="selYtCat">
                      Category
                    </label>
                    <select
                      id="selYtCat"
                      className="studio-select"
                      value={ytCategory}
                      onChange={(e) => setYtCategory(e.target.value)}
                    >
                      {YOUTUBE_CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="selYtReg">
                      Region
                    </label>
                    <select
                      id="selYtReg"
                      className="studio-select"
                      value={ytRegion}
                      onChange={(e) => setYtRegion(e.target.value)}
                    >
                      {YOUTUBE_REGION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field-group" style={{ marginTop: '0.45rem' }}>
                  <label className="field-label" htmlFor="inpTrendTopic">
                    Topic Focus (Optional)
                  </label>
                  <input
                    id="inpTrendTopic"
                    type="text"
                    className="studio-input"
                    value={trendTopic}
                    onChange={(e) => setTrendTopic(e.target.value)}
                    placeholder="e.g. AI tools for developers, personal finance..."
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-cyan btn-sm"
                  style={{ width: '100%', marginTop: '0.45rem' }}
                  disabled={isBusy}
                  onClick={handleFetchYouTubeTrends}
                >
                  <TrendingUp size={13} /> Fetch YouTube Trends & Synthesize Ideas
                </button>
              </div>
            </section>
          )}

          {activeMode === 'transform' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              {/* Transform Card */}
              <section className="surface-card">
                <div className="card-header">
                  <div className="card-title-group">
                    <span className="card-kicker">CONTENT REPURPOSING</span>
                    <h2 className="card-title">Transform Source Material</h2>
                    <p className="card-subtitle">
                      Convert raw articles, transcripts, or notes into structured Content DNA.
                    </p>
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="inpTransSource">
                    Source Text / Article / Transcript
                  </label>
                  <textarea
                    id="inpTransSource"
                    className="studio-textarea"
                    rows={4}
                    value={transformSource}
                    onChange={(e) => setTransformSource(e.target.value)}
                  />
                </div>

                <div className="field-group">
                  <div className="field-label">
                    <label htmlFor="inpTransGoal">Transformation Goal</label>
                    <RefineButton
                      apiBaseUrl={apiBaseUrl}
                      field="transform_goal"
                      value={transformGoal}
                      onChange={setTransformGoal}
                      disabled={isBusy}
                      context={{
                        audience: createAudience,
                        tone: createTone,
                        duration_seconds: createDuration,
                        language: createLanguage,
                        source_excerpt: transformSource.slice(0, 400),
                      }}
                    />
                  </div>
                  <textarea
                    id="inpTransGoal"
                    className="studio-textarea"
                    rows={2}
                    value={transformGoal}
                    onChange={(e) => setTransformGoal(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={isBusy || transformSource.trim().length < 20}
                  onClick={handleTransform}
                >
                  <Layers size={14} /> Transform to Content DNA
                </button>
              </section>

              {/* Adapt Intent Card */}
              <section className="surface-card">
                <div className="card-header">
                  <div className="card-title-group">
                    <span className="card-kicker">SEMANTIC ITERATION</span>
                    <h3 className="card-title" style={{ fontSize: '1.12rem' }}>
                      Adapt Existing DNA
                    </h3>
                  </div>
                </div>

                <div className="field-group">
                  <div className="field-label">
                    <label htmlFor="inpAdaptInst">Adaptation Instruction</label>
                    <RefineButton
                      apiBaseUrl={apiBaseUrl}
                      field="adaptation_instruction"
                      value={adaptInstruction}
                      onChange={setAdaptInstruction}
                      disabled={isBusy}
                      context={{
                        current_content: loadedDnaMatchesAdaptId
                          ? `${blueprint!.title}: ${blueprint!.one_line_concept}`
                          : typedAdaptContentId || null,
                        current_language: loadedDnaMatchesAdaptId ? blueprint!.language : null,
                        current_duration_seconds: loadedDnaMatchesAdaptId ? blueprint!.target_duration_seconds : null,
                      }}
                    />
                  </div>
                  <textarea
                    id="inpAdaptInst"
                    className="studio-textarea"
                    rows={2}
                    value={adaptInstruction}
                    onChange={(e) => setAdaptInstruction(e.target.value)}
                  />
                </div>

                <div className="field-row-2">
                  <div className="field-group">
                    <label className="field-label" htmlFor="inpAdaptId">
                      Content ID
                    </label>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <input
                        id="inpAdaptId"
                        type="text"
                        className="studio-input"
                        style={{ flex: 1, minWidth: 0 }}
                        list="knownContentIds"
                        value={adaptContentId}
                        onChange={(e) => setAdaptContentId(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleLoadContent();
                        }}
                        placeholder="e.g. ai-caution-shivam-v1"
                      />
                      <datalist id="knownContentIds">
                        {knownContentIds.map((item) => (
                          <option key={item.content_id} value={item.content_id} />
                        ))}
                      </datalist>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={isBusy || !typedAdaptContentId}
                        onClick={() => handleLoadContent()}
                        title="Load this content's latest Content DNA and video"
                      >
                        Load
                      </button>
                    </div>
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="inpAdaptVer">
                      Current Version
                    </label>
                    <input
                      id="inpAdaptVer"
                      type="number"
                      className="studio-input"
                      value={adaptVersion}
                      onChange={(e) => setAdaptVersion(Number(e.target.value))}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                  disabled={isBusy || adaptInstruction.trim().length < 5}
                  onClick={() => handleAdapt()}
                >
                  <Wand2 size={14} /> Adapt DNA Only (new version, no video)
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  disabled={isBusy || adaptInstruction.trim().length < 5}
                  onClick={() => handleAdaptVideo()}
                >
                  <Video size={14} /> Adapt & Generate Video
                  {loadedDnaMatchesAdaptId
                    ? ` v${Math.max(blueprint!.version, latestStoredVersions[blueprint!.content_id] ?? 0) + 1}`
                    : ' (next version)'}
                </button>
                <p className="field-hint" style={{ marginTop: '0.4rem' }}>
                  {loadedDnaMatchesAdaptId
                    ? `Evolves "${blueprint!.title}" (${blueprint!.content_id} v${blueprint!.version}) using your Create settings (persona, style, captions).`
                    : typedAdaptContentId
                    ? `Evolves the latest saved version of "${typedAdaptContentId}". Click Load to preview it first.`
                    : 'No content loaded: enter a Content ID and click Load, or the adaptation starts from the Create prompt.'}
                </p>
              </section>
            </div>
          )}

          {activeMode === 'understand' && (
            <section className="surface-card highlighted">
              <div className="card-header">
                <div className="card-title-group">
                  <span className="card-kicker">SEMANTIC EXTRACTION</span>
                  <h2 className="card-title">Extract Knowledge Structure</h2>
                  <p className="card-subtitle">
                    Extract concepts, relationships, and calibrated factual claims.
                  </p>
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="inpUndText">
                  Content to Analyze
                </label>
                <textarea
                  id="inpUndText"
                  className="studio-textarea"
                  rows={6}
                  value={understandText}
                  onChange={(e) => setUnderstandText(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="btn btn-cyan"
                style={{ width: '100%' }}
                disabled={isBusy || understandText.trim().length < 20}
                onClick={handleUnderstand}
              >
                <Network size={14} /> Run Semantic Analysis
              </button>
            </section>
          )}

          {activeMode === 'production' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              {/* Scene Composer Card */}
              <section className="surface-card">
                <div className="card-header">
                  <div className="card-title-group">
                    <span className="card-kicker">SCENE LEVEL STITCHER</span>
                    <h2 className="card-title" style={{ fontSize: '1.12rem' }}>
                      Compose Scene Shots
                    </h2>
                  </div>
                </div>

                <div className="field-row-2">
                  <div className="field-group">
                    <label className="field-label" htmlFor="inpCompId">
                      Content ID
                    </label>
                    <input
                      id="inpCompId"
                      type="text"
                      className="studio-input"
                      value={composeContentId}
                      onChange={(e) => setComposeContentId(e.target.value)}
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="inpCompNum">
                      Scene Number
                    </label>
                    <input
                      id="inpCompNum"
                      type="number"
                      className="studio-input"
                      value={composeSceneNumber}
                      onChange={(e) => setComposeSceneNumber(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="inpCompShots">
                    Shot URIs (one gs:// path per line)
                  </label>
                  <textarea
                    id="inpCompShots"
                    className="studio-textarea"
                    rows={3}
                    value={composeShotUris}
                    onChange={(e) => setComposeShotUris(e.target.value)}
                    placeholder="gs://.../shot_1.mp4\ngs://.../shot_2.mp4"
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%' }}
                  disabled={isBusy || !composeShotUris.trim()}
                  onClick={handleComposeScene}
                >
                  <Clapperboard size={13} /> Compose Scene MP4
                </button>
              </section>

              {/* Master Experience Render Card */}
              <section className="surface-card highlighted">
                <div className="card-header">
                  <div className="card-title-group">
                    <span className="card-kicker">MASTER TIMELINE</span>
                    <h2 className="card-title" style={{ fontSize: '1.12rem' }}>
                      Final Experience Render
                    </h2>
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="inpRendId">
                    Content ID
                  </label>
                  <input
                    id="inpRendId"
                    type="text"
                    className="studio-input"
                    value={renderContentId}
                    onChange={(e) => setRenderContentId(e.target.value)}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="inpRendScenes">
                    Scene URIs (one gs:// path per line)
                  </label>
                  <textarea
                    id="inpRendScenes"
                    className="studio-textarea"
                    rows={3}
                    value={renderSceneUris}
                    onChange={(e) => setRenderSceneUris(e.target.value)}
                    placeholder="gs://.../scene_1.mp4\ngs://.../scene_2.mp4"
                  />
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="inpRendAudio">
                    Optional Narration Audio URI
                  </label>
                  <input
                    id="inpRendAudio"
                    type="text"
                    className="studio-input"
                    value={renderNarrationUri}
                    onChange={(e) => setRenderNarrationUri(e.target.value)}
                    placeholder="gs://.../narration.wav"
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={isBusy || !renderSceneUris.trim()}
                  onClick={handleRenderExperience}
                >
                  <Film size={14} /> Render Master Video
                </button>
              </section>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Output Canvas & Visual Storyboards */}
        <div className="right-column">
          {/* Status & Diagnostic Banners */}
          {isBusy && (
            <div className="loading-banner">
              <Sparkles size={16} />
              <span>{busyMessage}</span>
            </div>
          )}

          {successBanner && (
            <div className="diagnostic-banner success">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600, color: '#34d399' }}>
                <CheckCircle2 size={15} /> Action Completed
              </div>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-primary)' }}>{successBanner}</p>
            </div>
          )}

          {errorBanner && (
            <div className="diagnostic-banner error">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600, color: '#fb7185' }}>
                <AlertCircle size={15} /> {errorBanner.title}
              </div>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-primary)' }}>{errorBanner.message}</p>
            </div>
          )}

          {/* Dynamic Main Canvas Display */}
          {activeMode === 'create' && blueprint && (
            <BlueprintCanvas
              blueprint={blueprint}
              onGenerateSceneNarration={handleGenerateSceneNarration}
              onQuickAdaptFromBlueprint={(inst) => handleAdapt(inst)}
              onQuickAdaptVideoFromBlueprint={(inst) => handleAdaptVideo(inst)}
              onGenerateVideo={handleGenerateVideoFromBlueprint}
              onSendSceneToComposer={(sc) => {
                setComposeContentId(blueprint.content_id);
                setComposeSceneNumber(sc.scene_number);
                setActiveMode('production');
              }}
              isBusy={isBusy}
            />
          )}

          {activeMode === 'trends' && trendResult && (
            <TrendCanvas
              trendResult={trendResult}
              youtubeResult={youtubeResult}
              onLoadIdeaIntoCreate={handleLoadIdeaIntoCreate}
              isBusy={isBusy}
            />
          )}

          {activeMode === 'understand' && understanding && (
            <UnderstandingCanvas understanding={understanding} />
          )}

          {activeMode === 'production' && (videoJob || videoResult || narrationResult || composeResult || renderResult) && (
            <ProductionCanvas
              apiBaseUrl={apiBaseUrl}
              videoJob={videoJob}
              isBusy={isBusy}
              onRevoice={handleRevoice}
              onLocalize={handleLocalize}
              videoResult={videoResult}
              narrationResult={narrationResult}
              composeResult={composeResult}
              renderResult={renderResult}
              onCopyUriToRender={(uri, type) => {
                if (type === 'scene') {
                  setRenderSceneUris((prev) => (prev ? `${prev}\n${uri}` : uri));
                  notifySuccess('Scene URI added to master render list.');
                } else {
                  setRenderNarrationUri(uri);
                  notifySuccess('Narration URI set for master render.');
                }
              }}
            />
          )}

          {/* Fallback Empty States when canvas has not run yet */}
          {activeMode === 'create' && !blueprint && (
            <div className="surface-card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'var(--bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  color: 'var(--accent-amber)',
                }}
              >
                <Sparkles size={24} />
              </div>
              <h3 className="card-title">Content Blueprint Canvas</h3>
              <p className="card-subtitle" style={{ maxWidth: 440, margin: '0.4rem auto 1.2rem' }}>
                Enter your creation prompt on the left and generate structured Content DNA, scene sequences, and Veo shot blueprints.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={isBusy}
                onClick={() => handleCreateBlueprint()}
              >
                Generate Example Blueprint
              </button>
            </div>
          )}

          {activeMode === 'trends' && !trendResult && (
            <div className="surface-card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'var(--bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  color: 'var(--accent-cyan)',
                }}
              >
                <TrendingUp size={24} />
              </div>
              <h3 className="card-title">Live Trend Radar</h3>
              <p className="card-subtitle" style={{ maxWidth: 440, margin: '0.4rem auto 1.2rem' }}>
                Pick a YouTube category and region to discover what’s engaging audiences and turn it directly into video blueprints.
              </p>
              <button
                type="button"
                className="btn btn-cyan btn-sm"
                disabled={isBusy}
                onClick={handleFetchYouTubeTrends}
              >
                Fetch Trending YouTube Content
              </button>
            </div>
          )}

          {activeMode === 'understand' && !understanding && (
            <div className="surface-card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'var(--bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  color: 'var(--accent-violet)',
                }}
              >
                <Network size={24} />
              </div>
              <h3 className="card-title">Semantic Knowledge Graph</h3>
              <p className="card-subtitle" style={{ maxWidth: 440, margin: '0.4rem auto 1.2rem' }}>
                Extract definitions, prerequisite knowledge hierarchies, and factually calibrated claim trees from any source text.
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={isBusy}
                onClick={handleUnderstand}
              >
                Analyze Example Text
              </button>
            </div>
          )}

          {activeMode === 'production' &&
            !videoJob &&
            !videoResult &&
            !narrationResult &&
            !composeResult &&
            !renderResult && (
              <div className="surface-card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'var(--bg-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem',
                    color: 'var(--accent-amber)',
                  }}
                >
                  <Film size={24} />
                </div>
                <h3 className="card-title">Media & Render Studio</h3>
                <p className="card-subtitle" style={{ maxWidth: 440, margin: '0.4rem auto 1.2rem' }}>
                  Execute Veo video shot generation, Cloud TTS narration synthesis, and FFmpeg master timeline rendering.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={isBusy}
                  onClick={() => setActiveMode('create')}
                >
                  Start in Create Mode
                </button>
              </div>
            )}
        </div>
      </main>
    </div>
  );
};

export default App;
