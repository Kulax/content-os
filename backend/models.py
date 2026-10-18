# from typing import List
# from pydantic import BaseModel, Field


# class Audience(BaseModel):
#     knowledge_level: str = Field(
#         description="The audience's subject knowledge level."
#     )
#     age_group: str = Field(
#         description="Approximate audience age group."
#     )
#     interests: List[str] = Field(
#         description="Relevant audience interests."
#     )


# class Scene(BaseModel):
#     scene_number: int
#     title: str
#     duration_seconds: int
#     purpose: str
#     narration: str
#     visual_description: str
#     on_screen_text: str


# class ContentBlueprint(BaseModel):
#     title: str
#     one_line_concept: str

#     audience: Audience

#     goal: str
#     tone: str
#     format: str
#     language: str
#     target_duration_seconds: int

#     key_concepts: List[str]
#     narrative_structure: List[str]

#     scenes: List[Scene]

#     visual_style: str
#     narration_style: str

#     learning_outcomes: List[str]
#     quality_checks: List[str]

# class CreateRequest(BaseModel):
#     prompt: str = Field(
#         min_length=5,
#         max_length=5000,
#         description="The user's content creation request.",
#     )
#     audience_level: str = Field(
#         default="general",
#         max_length=100,
#     )
#     duration_seconds: int = Field(
#         default=120,
#         ge=15,
#         le=3600,
#     )
#     language: str = Field(
#         default="English",
#         max_length=50,
#     )
#     format: str = Field(
#         default="video",
#         max_length=50,
#     )
#     tone: str = Field(
#         default="engaging",
#         max_length=100,
#     )


from typing import List

from pydantic import BaseModel, Field


class Audience(BaseModel):
    knowledge_level: str = Field(
        description="The audience's subject knowledge level."
    )
    age_group: str = Field(
        description="Approximate audience age group."
    )
    interests: List[str] = Field(
        description="Relevant audience interests."
    )


class Shot(BaseModel):
    shot_number: int
    duration_seconds: int = Field(
        ge=4,
        le=8,
        description="Veo-compatible shot duration in seconds."
    )
    purpose: str
    shot_type: str = Field(
        default="A-Roll (Host / Subject)",
        description="'A-Roll (Host / Subject)' or 'B-Roll (Concept / Object / Environment)'."
    )
    visual_action: str = Field(
        default="",
        description="Chronological sequential visual action unique to this shot."
    )
    camera_direction: str
    motion: str
    continuity_requirements: str
    generation_method: str = Field(
        default="veo",
        description="Recommended generation method for this shot."
    )


class Scene(BaseModel):
    scene_number: int
    title: str
    duration_seconds: int
    purpose: str
    narration: str
    visual_description: str
    on_screen_text: str
    shots: List[Shot] = Field(
        default_factory=list,
        description="Planned media-generation shots for this scene."
    )


class CreatorPersona(BaseModel):
    name: str = Field(default="Creator", description="Creator identity name or alias.")
    role_title: str = Field(default="Host / Presenter", description="On-camera role or presentation style.")
    visual_description: str = Field(
        default="",
        description="Visual anchor description (clothing, appearance, framing, setting) for subject consistency."
    )
    voice_tone: str = Field(default="charismatic and natural", description="Vocal cadence and delivery style.")
    presentation_mode: str = Field(
        default="on_camera_host",
        description="Presentation mode: on_camera_host, voiceover_with_avatar, reaction_commentary, or b_roll_focused."
    )
    reference_image_uri: str | None = Field(
        default=None,
        description="Optional GCS or public URL of creator reference image for Veo conditioning."
    )


class ActionStep(BaseModel):
    step_number: int
    phase: str = Field(description="Production phase: 'Pre-production', 'Filming / AI Gen', 'Audio / Narration', 'Publishing & Hook'")
    action: str
    why_it_matters: str
    estimated_minutes: int = Field(default=5)


class CreatorExecutionPlan(BaseModel):
    target_format: str = Field(default="Short-form Video (9:16) / YouTube Video (16:9)")
    difficulty_level: str = Field(default="Beginner-friendly")
    setup_time_minutes: int = Field(default=15)
    hook_sentence: str
    key_takeaway: str
    step_by_step_workflow: List[ActionStep] = Field(default_factory=list)
    call_to_action: str


class VisualContinuityAnchor(BaseModel):
    character_dna: str = Field(
        default="",
        description="Immutable physical description of the primary human/character (face, hair, skin tone, exact clothing items/colors, accessories, age). Must stay 100% identical across all on-camera clips."
    )
    environment_dna: str = Field(
        default="",
        description="Immutable studio/environment description (wall color, furniture, lighting color temperature, architectural style) to anchor the location."
    )
    key_recurring_objects: List[str] = Field(
        default_factory=list,
        description="List of specific physical objects, devices, or props with immutable color and texture definitions across clips."
    )
    color_palette_tokens: List[str] = Field(
        default_factory=list,
        description="Specific color codes/tones (e.g., 'Matte Obsidian #0b0c10', 'Deep Electric Cyan #00d2ff', 'Warm Amber 3200K') to maintain consistent grading."
    )


class NarrationVoice(BaseModel):
    gender: str = Field(
        default="unspecified",
        description="Narrator voice gender: 'male', 'female' or 'unspecified'. Follow any voice the user asks for; otherwise match a clearly male or female on-camera host."
    )
    speaking_rate: float = Field(
        default=1.0,
        description="Speech pace multiplier between 0.85 (calm, deliberate) and 1.15 (energetic, urgent)."
    )
    delivery: str = Field(
        default="",
        description="Short delivery notes such as emotion and energy (e.g. 'angry, forceful, urgent')."
    )


class ContentBlueprint(BaseModel):
    # Application-owned content identity.
    # These are assigned by the backend, not by Gemini.
    content_id: str = Field(
        default="",
        description="Unique identifier for this content."
    )
    version: int = Field(
        default=1,
        ge=1,
        description="Version of the Content DNA."
    )

    title: str
    one_line_concept: str

    audience: Audience

    goal: str
    tone: str
    format: str
    language: str
    target_duration_seconds: int

    key_concepts: List[str]
    narrative_structure: List[str]

    scenes: List[Scene]

    visual_style: str
    narration_style: str
    narration_voice: NarrationVoice | None = Field(
        default=None,
        description="Voice used to synthesize the narration (gender, pace, delivery)."
    )

    learning_outcomes: List[str]
    quality_checks: List[str]
    creator_persona: CreatorPersona | None = Field(default=None, description="Creator identity and role conditioning.")
    execution_plan: CreatorExecutionPlan | None = Field(default=None, description="Clear, digestible action plan for the creator.")
    visual_continuity_anchor: VisualContinuityAnchor | None = Field(
        default=None,
        description="Master visual continuity anchor for character, environment, and objects across all clips."
    )


class CreateRequest(BaseModel):
    prompt: str = Field(
        min_length=3,
        max_length=5000,
        description="The user's content creation request.",
    )
    audience_level: str = Field(
        default="general",
        max_length=100,
    )
    duration_seconds: int = Field(
        default=120,
        ge=4,
        le=7200,
    )
    language: str = Field(
        default="English",
        max_length=50,
    )
    target_languages: List[str] = Field(
        default_factory=lambda: ["English"],
        description="List of target languages for multi-language localization."
    )
    creator_persona: CreatorPersona | None = Field(
        default=None,
        description="Optional digital twin or creator profile to feature in the video."
    )
    visual_style: str = Field(
        default="Cinematic Realistic",
        description="Rendering style preset: 'Cinematic Realistic', '3D Pixar / Animation', '2D Anime / Cartoon', 'Cyberpunk / Sci-Fi', 'Claymation / Stop-Motion', 'Watercolor / Storybook', 'Retro 80s VHS'."
    )
    captions_enabled: bool = Field(
        default=True,
        description="Burn narration captions into generated scene and final videos."
    )
    format: str = Field(
        default="video",
        max_length=50,
    )
    tone: str = Field(
        default="engaging",
        max_length=100,
    )


class ComposeSceneRequest(BaseModel):
    content_id: str = Field(
        min_length=3,
        max_length=200,
    )
    scene_number: int = Field(
        ge=1,
    )
    shot_uris: List[str] = Field(
        min_length=1,
        description="Ordered GCS URIs for scene shots."
    )


class SubtitleCue(BaseModel):
    start_seconds: float = Field(ge=0)
    end_seconds: float = Field(gt=0)
    text: str = Field(min_length=1, max_length=2000)


class RenderExperienceRequest(BaseModel):
    content_id: str = Field(
        min_length=3,
        max_length=200,
    )
    scene_uris: List[str] = Field(
        min_length=1,
        description="Ordered scene-level video URIs to stitch into a final experience."
    )
    narration_audio_uri: str | None = Field(
        default=None,
        description="Optional narration audio URI to mux with final video."
    )
    subtitle_cues: List[SubtitleCue] = Field(
        default_factory=list,
        description="Optional timed subtitle cues to export as SRT."
    )
    burn_captions: bool = Field(
        default=True,
        description="Burn subtitle_cues into the final video in addition to exporting the SRT file."
    )


class GenerateNarrationRequest(BaseModel):
    content_id: str = Field(
        min_length=3,
        max_length=200,
    )
    text: str = Field(
        min_length=1,
        max_length=20000,
    )
    language_code: str = Field(
        default="en-US",
        min_length=2,
        max_length=20,
    )
    voice_name: str | None = Field(
        default=None,
    )
    voice_gender: str | None = Field(
        default=None,
        description="Optional 'male' or 'female'; ignored when voice_name is given.",
    )
    speaking_rate: float = Field(
        default=1.0,
        ge=0.25,
        le=4.0,
    )
    scene_number: int = Field(
        default=1,
        ge=1,
    )


class TransformRequest(BaseModel):
    source_text: str = Field(
        min_length=20,
        max_length=100000,
    )
    transform_goal: str = Field(
        min_length=5,
        max_length=1000,
    )
    audience_level: str = Field(
        default="general",
        max_length=100,
    )
    duration_seconds: int = Field(
        default=120,
        ge=15,
        le=3600,
    )
    language: str = Field(
        default="English",
        max_length=50,
    )
    format: str = Field(
        default="video",
        max_length=50,
    )
    tone: str = Field(
        default="engaging",
        max_length=100,
    )


class AdaptRequest(BaseModel):
    base_request: CreateRequest
    adaptation_instruction: str = Field(
        min_length=5,
        max_length=2000,
    )
    content_id: str | None = Field(
        default=None,
        max_length=200,
    )
    current_version: int = Field(
        default=1,
        ge=1,
    )
    base_blueprint: ContentBlueprint | None = Field(
        default=None,
        description="Current Content DNA version; when provided the adaptation evolves it instead of starting over.",
    )


class BlueprintVideoRequest(BaseModel):
    blueprint: ContentBlueprint = Field(
        description="Existing Content DNA version to render as video (no new blueprint is generated)."
    )
    options: CreateRequest = Field(
        description="Render options: creator_persona, visual_style, language and captions_enabled are used."
    )


class RevoiceRequest(BaseModel):
    version: int | None = Field(
        default=None,
        ge=1,
        description="Version to re-voice; defaults to the latest version with a saved plan or video.",
    )
    voice_gender: str | None = Field(
        default=None,
        description="Override the narrator gender ('male' or 'female'); defaults to the plan's narration voice.",
    )
    captions_enabled: bool = Field(default=True)


class LocalizeRequest(BaseModel):
    version: int | None = Field(
        default=None,
        ge=1,
        description="Version to localize; defaults to the latest version with a saved plan or video.",
    )
    languages: List[str] = Field(
        min_length=1,
        description="Languages for dubbed versions, e.g. ['Hindi', 'Spanish'].",
    )
    captions_enabled: bool = Field(default=True)


class ConceptNode(BaseModel):
    concept: str
    definition: str
    prerequisites: List[str] = Field(default_factory=list)


class RelationshipNode(BaseModel):
    source: str
    relation: str
    target: str


class ClaimNode(BaseModel):
    claim: str
    evidence_or_context: str
    confidence: float = Field(ge=0.0, le=1.0)


class ContentUnderstanding(BaseModel):
    summary: str
    key_concepts: List[str] = Field(default_factory=list)
    concepts: List[ConceptNode] = Field(default_factory=list)
    relationships: List[RelationshipNode] = Field(default_factory=list)
    claims: List[ClaimNode] = Field(default_factory=list)
    uncertainty_notes: List[str] = Field(default_factory=list)


class UnderstandRequest(BaseModel):
    content_text: str = Field(
        min_length=20,
        max_length=100000,
    )
    audience_level: str = Field(
        default="general",
        max_length=100,
    )


class TrendSignal(BaseModel):
    source_type: str = Field(
        description="Signal source type: youtube_title, youtube_caption, youtube_video_notes, mcp_feed, or custom."
    )
    text: str = Field(
        min_length=1,
        max_length=20000,
    )
    source_label: str | None = Field(
        default=None,
        max_length=300,
    )
    source_url: str | None = Field(
        default=None,
        max_length=2000,
    )


class TrendIdeationRequest(BaseModel):
    topic: str = Field(
        default="",
        max_length=500,
    )
    audience_level: str = Field(
        default="general",
        max_length=100,
    )
    language: str = Field(
        default="English",
        max_length=50,
    )
    max_ideas: int = Field(
        default=5,
        ge=1,
        le=10,
    )
    signals: List[TrendSignal] = Field(
        default_factory=list,
    )
    mcp_dump: str | None = Field(
        default=None,
        max_length=200000,
        description="Optional raw output from YouTube/Google MCP integrations.",
    )
    additional_context: str | None = Field(
        default=None,
        max_length=20000,
    )


class TrendIdea(BaseModel):
    title: str
    why_trending: str
    audience_fit: str
    key_points: List[str] = Field(default_factory=list)
    content_angle: str
    recommended_hook: str
    risk_notes: List[str] = Field(default_factory=list)
    create_prompt: str
    execution_plan: CreatorExecutionPlan | None = Field(
        default=None,
        description="Crystal-clear creator execution map: what to do step-by-step."
    )
    creator_persona: CreatorPersona | None = Field(
        default=None,
        description="Suggested persona framing for this trend."
    )


class TrendIdeationResponse(BaseModel):
    summary: str
    top_insights: List[str] = Field(default_factory=list)
    ideas: List[TrendIdea] = Field(default_factory=list)
    suggested_next_steps: List[str] = Field(default_factory=list)
    top_create_request: CreateRequest


class YouTubeTrendVideo(BaseModel):
    video_id: str
    title: str
    channel_title: str
    published_at: str | None = None
    view_count: int | None = None
    like_count: int | None = None
    comment_count: int | None = None
    category_id: str | None = None
    video_url: str


class YouTubeTrendIdeationRequest(BaseModel):
    category: str = Field(
        default="entertainment",
        max_length=100,
        description="Human-readable category like entertainment, music, news, education, sports, gaming, or technology.",
    )
    category_id: str | None = Field(
        default=None,
        max_length=10,
        description="Optional explicit YouTube category ID. Overrides category if provided.",
    )
    region_code: str = Field(
        default="US",
        min_length=2,
        max_length=2,
    )
    max_results: int = Field(
        default=15,
        ge=5,
        le=50,
    )
    audience_level: str = Field(
        default="general",
        max_length=100,
    )
    language: str = Field(
        default="English",
        max_length=50,
    )
    max_ideas: int = Field(
        default=5,
        ge=1,
        le=10,
    )
    topic_override: str | None = Field(
        default=None,
        max_length=500,
    )
    additional_context: str | None = Field(
        default=None,
        max_length=20000,
    )


class YouTubeTrendIdeationResponse(BaseModel):
    resolved_category: str
    resolved_category_id: str
    region_code: str
    fetched_count: int
    source_note: str = Field(
        default="",
        description="Where the videos came from (trending chart, or most-viewed recent uploads when a category has no chart).",
    )
    trending_videos: List[YouTubeTrendVideo] = Field(default_factory=list)
    ideation: TrendIdeationResponse

class RefinePromptRequest(BaseModel):
    field: str = Field(
        description="Which input is being refined: visual_anchor, creator_prompt, transform_goal or adaptation_instruction.",
        max_length=50,
    )
    text: str = Field(min_length=3, max_length=5000)
    context: dict[str, str] = Field(
        default_factory=dict,
        description="Related settings (audience, tone, language, role, style...) so the refinement stays consistent.",
    )
