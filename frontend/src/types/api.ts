// Exact TypeScript mirrors of backend/models.py and backend/main.py response contracts

export interface Audience {
  knowledge_level: string;
  age_group: string;
  interests: string[];
}

export interface Shot {
  shot_number: number;
  duration_seconds: number;
  purpose: string;
  shot_type?: string;
  visual_action?: string;
  camera_direction: string;
  motion: string;
  continuity_requirements?: string;
  generation_method: string;
}

export interface Scene {
  scene_number: number;
  title: string;
  duration_seconds: number;
  purpose: string;
  narration: string;
  visual_description: string;
  on_screen_text: string;
  shots: Shot[];
}

export interface CreatorPersona {
  name: string;
  role_title: string;
  visual_description: string;
  voice_tone: string;
  presentation_mode: 'on_camera_host' | 'voiceover_with_avatar' | 'reaction_commentary' | 'b_roll_focused';
  reference_image_uri?: string | null;
}

export interface ActionStep {
  step_number: number;
  phase: string;
  action: string;
  why_it_matters: string;
  estimated_minutes: number;
}

export interface CreatorExecutionPlan {
  target_format: string;
  difficulty_level: string;
  setup_time_minutes: number;
  hook_sentence: string;
  key_takeaway: string;
  step_by_step_workflow: ActionStep[];
  call_to_action: string;
}

export interface VisualContinuityAnchor {
  character_dna: string;
  environment_dna: string;
  key_recurring_objects: string[];
  color_palette_tokens: string[];
}

export interface NarrationVoice {
  gender: string;
  speaking_rate: number;
  delivery: string;
}

export interface ContentBlueprint {
  content_id: string;
  version: number;
  title: string;
  one_line_concept: string;
  audience: Audience;
  goal: string;
  tone: string;
  format: string;
  language: string;
  target_duration_seconds: number;
  key_concepts: string[];
  narrative_structure: string[];
  scenes: Scene[];
  visual_style: string;
  narration_style: string;
  narration_voice?: NarrationVoice | null;
  learning_outcomes: string[];
  quality_checks: string[];
  creator_persona?: CreatorPersona | null;
  execution_plan?: CreatorExecutionPlan | null;
  visual_continuity_anchor?: VisualContinuityAnchor | null;
}

export interface CreateRequest {
  prompt: string;
  audience_level: string;
  duration_seconds: number;
  language: string;
  target_languages?: string[];
  creator_persona?: CreatorPersona | null;
  visual_style?: string;
  captions_enabled?: boolean;
  format: string;
  tone: string;
}

export interface TransformRequest {
  source_text: string;
  transform_goal: string;
  audience_level: string;
  duration_seconds: number;
  language: string;
  format: string;
  tone: string;
}

export interface AdaptRequest {
  base_request: CreateRequest;
  adaptation_instruction: string;
  content_id?: string | null;
  current_version: number;
  base_blueprint?: ContentBlueprint | null;
}

export interface BlueprintVideoRequest {
  blueprint: ContentBlueprint;
  options: CreateRequest;
}

export interface ContentRecord {
  content_id: string;
  version: number;
  versions: number[];
  latest_version: number;
  recovered: boolean;
  blueprint: ContentBlueprint;
  video_result: CreateVideoResponse | null;
}

export interface ContentSummary {
  content_id: string;
}

export type RefineField = 'visual_anchor' | 'creator_prompt' | 'transform_goal' | 'adaptation_instruction';

export interface RefinePromptRequest {
  field: RefineField;
  text: string;
  context: Record<string, string>;
}

export interface RefinePromptResponse {
  field: RefineField;
  original: string;
  refined: string;
  notes: string;
}

export interface RevoiceRequest {
  version?: number | null;
  voice_gender?: 'male' | 'female' | null;
  captions_enabled: boolean;
}

export interface LocalizeRequest {
  version?: number | null;
  languages: string[];
  captions_enabled: boolean;
}

export interface LocalizedScene extends Partial<SceneVideoOutput> {
  scene_number: number;
  narration?: string;
}

export interface Localization {
  language: string;
  language_code: string | null;
  title?: string;
  final_video_uri: string | null;
  render_status?: string;
  render_message?: string;
  status: 'completed' | 'failed' | string;
  error?: string | null;
  scenes: LocalizedScene[];
}

export interface UnderstandRequest {
  content_text: string;
  audience_level: string;
}

export interface ConceptNode {
  concept: string;
  definition: string;
  prerequisites: string[];
}

export interface RelationshipNode {
  source: string;
  relation: string;
  target: string;
}

export interface ClaimNode {
  claim: string;
  evidence_or_context: string;
  confidence: number;
}

export interface ContentUnderstanding {
  summary: string;
  key_concepts: string[];
  concepts: ConceptNode[];
  relationships: RelationshipNode[];
  claims: ClaimNode[];
  uncertainty_notes: string[];
}

export interface TrendSignal {
  source_type: string;
  text: string;
  source_label?: string | null;
  source_url?: string | null;
}

export interface TrendIdeationRequest {
  topic: string;
  audience_level: string;
  language: string;
  max_ideas: number;
  signals: TrendSignal[];
  mcp_dump?: string | null;
  additional_context?: string | null;
}

export interface TrendIdea {
  title: string;
  why_trending: string;
  audience_fit: string;
  key_points: string[];
  content_angle: string;
  recommended_hook: string;
  risk_notes: string[];
  create_prompt: string;
  execution_plan?: CreatorExecutionPlan | null;
  creator_persona?: CreatorPersona | null;
}

export interface TrendIdeationResponse {
  summary: string;
  top_insights: string[];
  ideas: TrendIdea[];
  suggested_next_steps: string[];
  top_create_request: CreateRequest;
}

export interface YouTubeTrendVideo {
  video_id: string;
  title: string;
  channel_title: string;
  published_at?: string | null;
  view_count?: number | null;
  like_count?: number | null;
  comment_count?: number | null;
  category_id?: string | null;
  video_url: string;
}

export interface YouTubeTrendIdeationRequest {
  category: string;
  category_id?: string | null;
  region_code: string;
  max_results: number;
  audience_level: string;
  language: string;
  max_ideas: number;
  topic_override?: string | null;
  additional_context?: string | null;
}

export interface YouTubeTrendIdeationResponse {
  resolved_category: string;
  resolved_category_id: string;
  region_code: string;
  fetched_count: number;
  source_note?: string;
  trending_videos: YouTubeTrendVideo[];
  ideation: TrendIdeationResponse;
}

export interface ShotAsset {
  shot_number: number;
  scene_number?: number;
  duration_seconds: number;
  generation_method: string;
  video_path: string;
}

export interface SceneVideoOutput {
  scene_number: number;
  scene_title: string;
  duration_seconds: number;
  shot_plan: Shot[];
  shot_assets: ShotAsset[];
  scene_video_path: string | null;
  composition_status: string;
  composition_message: string;
  narration_audio_uri: string | null;
  narration_voice_name?: string | null;
  narration_status: string;
  narration_message: string;
  narrated_scene_video_path: string | null;
  narrated_scene_status: string;
  narrated_scene_message: string;
  captioned_scene_video_path?: string | null;
  caption_status?: string;
  caption_message?: string;
  preview_video_path?: string | null;
}

export interface CreateVideoResponse {
  content_id: string;
  version: number;
  total_scenes?: number;
  final_video_uri?: string | null;
  render_status?: string;
  render_message?: string;
  scenes?: SceneVideoOutput[];
  // Backwards compatibility for single-scene readers:
  scene_number: number;
  scene_title: string;
  shot_plan: Shot[];
  shot_assets: ShotAsset[];
  scene_video_path: string | null;
  composition_status: string;
  composition_message: string;
  narration_audio_uri: string | null;
  narration_voice_name?: string | null;
  narration_status: string;
  narration_message: string;
  narrated_scene_video_path: string | null;
  narrated_scene_status: string;
  narrated_scene_message: string;
  captioned_scene_video_path?: string | null;
  caption_status?: string;
  caption_message?: string;
  face_reference_used?: boolean;
  blueprint?: ContentBlueprint;
  localizations?: Localization[];
  status: string;
}

export type VideoJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface VideoJob {
  job_id: string;
  status: VideoJobStatus;
  stage: string;
  message: string;
  created_at: number;
  updated_at: number;
  content_id: string | null;
  version: number | null;
  title: string | null;
  total_scenes: number;
  total_shots: number;
  completed_shots: number;
  face_reference_used: boolean;
  scenes: SceneVideoOutput[];
  localizations?: Localization[];
  final_video_uri: string | null;
  result: CreateVideoResponse | null;
  error: string | null;
}

export interface PersonaPhotoUploadResponse {
  status: string;
  file_id: string;
  filename: string;
  url: string;
  gcs_uri?: string | null;
}

export interface GenerateNarrationRequest {
  content_id: string;
  text: string;
  language_code: string;
  voice_name?: string | null;
  speaking_rate: number;
  scene_number: number;
}

export interface GenerateNarrationResponse {
  content_id: string;
  scene_number: number;
  audio_uri: string;
  status: string;
}

export interface ComposeSceneRequest {
  content_id: string;
  scene_number: number;
  shot_uris: string[];
}

export interface ComposeSceneResponse {
  content_id: string;
  scene_number: number;
  scene_video_path: string | null;
  composition_status: string;
  composition_message: string;
}

export interface SubtitleCue {
  start_seconds: number;
  end_seconds: number;
  text: string;
}

export interface RenderExperienceRequest {
  content_id: string;
  scene_uris: string[];
  narration_audio_uri?: string | null;
  subtitle_cues: SubtitleCue[];
  burn_captions?: boolean;
}

export interface RenderExperienceResponse {
  content_id: string;
  base_video_uri: string | null;
  final_video_uri: string | null;
  subtitle_uri: string | null;
  render_status: string;
  narration_status?: string;
  narration_message?: string;
  subtitle_status?: string;
  subtitle_message?: string;
  caption_status?: string;
  caption_message?: string;
  render_message: string;
}

export interface HealthResponse {
  status: string;
  project: string;
  max_video_seconds?: number;
}
