import React, { useState } from 'react';
import {
  CheckCircle2,
  Clapperboard,
  Clock,
  Compass,
  FileAudio,
  Film,
  Globe,
  ListChecks,
  Sparkles,
  Target,
  User,
  UserCheck,
  Video,
  Wand2,
  Zap,
} from 'lucide-react';
import { ContentBlueprint, Scene } from '../types/api';

interface BlueprintCanvasProps {
  blueprint: ContentBlueprint;
  onGenerateSceneNarration: (scene: Scene) => void;
  onQuickAdaptFromBlueprint: (instruction: string) => void;
  onQuickAdaptVideoFromBlueprint: (instruction: string) => void;
  onGenerateVideo: () => void;
  onSendSceneToComposer: (scene: Scene) => void;
  isBusy: boolean;
}

export const BlueprintCanvas: React.FC<BlueprintCanvasProps> = ({
  blueprint,
  onGenerateSceneNarration,
  onQuickAdaptFromBlueprint,
  onQuickAdaptVideoFromBlueprint,
  onGenerateVideo,
  onSendSceneToComposer,
  isBusy,
}) => {
  const [quickAdaptText, setQuickAdaptText] = useState(
    'Make it simpler for a 12-year-old and condense to 60 seconds.'
  );

  return (
    <div className="surface-card highlighted">
      <div className="card-header">
        <div className="card-title-group">
          <span className="card-kicker">
            CONTENT DNA BLUEPRINT • ID: {blueprint.content_id || 'unassigned'} • v
            {blueprint.version}
          </span>
          <h2 className="card-title">{blueprint.title}</h2>
          <p className="card-subtitle">{blueprint.one_line_concept}</p>
        </div>

        <div className="badge-row">
          <span className="meta-badge amber">
            <Clock size={12} /> {blueprint.target_duration_seconds}s
          </span>
          <span className="meta-badge cyan">
            <Globe size={12} /> {blueprint.language}
          </span>
          <span className="meta-badge emerald">
            <Compass size={12} /> {blueprint.tone}
          </span>
          <span className="meta-badge">
            <Film size={12} /> {blueprint.format}
          </span>
          {blueprint.creator_persona && (
            <span className="meta-badge emerald">
              <User size={12} /> Host: {blueprint.creator_persona.name}
            </span>
          )}
          {blueprint.narration_voice && blueprint.narration_voice.gender !== 'unspecified' && (
            <span className="meta-badge cyan" title={blueprint.narration_voice.delivery || 'Narrator voice'}>
              <FileAudio size={12} /> {blueprint.narration_voice.gender} voice ·{' '}
              {Number(blueprint.narration_voice.speaking_rate || 1).toFixed(2)}x
            </span>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={isBusy}
            onClick={onGenerateVideo}
            title="Render this exact DNA version as video (no new blueprint is generated)"
          >
            <Video size={13} /> Generate Video for v{blueprint.version}
          </button>
        </div>
      </div>

      {/* ACTIONABLE CREATOR ROADMAP / EXECUTION PLAN */}
      {blueprint.execution_plan && (
        <div
          className="scene-box"
          style={{
            marginBottom: '1.15rem',
            background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, rgba(14, 16, 23, 0.95) 100%)',
            borderColor: 'rgba(245, 158, 11, 0.4)',
          }}
        >
          <div
            className="scene-box-label"
            style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}
          >
            <Zap size={14} /> ACTIONABLE CREATOR EXECUTION PLAN • {blueprint.execution_plan.target_format} •{' '}
            <Clock size={12} /> ~{blueprint.execution_plan.setup_time_minutes} min setup
          </div>

          <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.92rem' }}>
              <strong style={{ color: '#fbbf24' }}>Opening 3-Second Hook:</strong> “
              {blueprint.execution_plan.hook_sentence}”
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <strong>Core Creator Takeaway:</strong> {blueprint.execution_plan.key_takeaway}
            </div>

            {blueprint.execution_plan.step_by_step_workflow?.length > 0 && (
              <div style={{ marginTop: '0.4rem' }}>
                <div className="scene-box-label" style={{ color: 'var(--text-muted)' }}>
                  Production Roadmap & What to do:
                </div>
                <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.25rem' }}>
                  {blueprint.execution_plan.step_by_step_workflow.map((st) => (
                    <div
                      key={st.step_number}
                      className="shot-pill-card"
                      style={{
                        padding: '0.55rem 0.75rem',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.6rem',
                        background: 'var(--bg-panel)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                        <span className="meta-badge amber" style={{ padding: '0.12rem 0.45rem' }}>
                          Step {st.step_number} • {st.phase}
                        </span>
                        <span style={{ fontSize: '0.83rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                          {st.action}
                        </span>
                      </div>
                      <span className="field-hint" style={{ color: 'var(--accent-cyan)' }}>
                        {st.why_it_matters} (~{st.estimated_minutes}m)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: '0.84rem', color: '#34d399', marginTop: '0.35rem' }}>
              <strong>Final Call to Action:</strong> “{blueprint.execution_plan.call_to_action}”
            </div>
          </div>
        </div>
      )}

      {/* Creator Digital Twin Anchor Card */}
      {blueprint.creator_persona && (
        <div
          className="scene-box"
          style={{
            marginBottom: '1rem',
            borderColor: 'rgba(16, 185, 129, 0.35)',
            background: 'rgba(16, 185, 129, 0.04)',
          }}
        >
          <div className="scene-box-label" style={{ color: '#34d399' }}>
            <User size={12} style={{ display: 'inline', marginRight: 4 }} />
            Subject Likeness & Persona Anchor: {blueprint.creator_persona.name} ({blueprint.creator_persona.role_title})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.35rem' }}>
            <p className="scene-box-text">
              <strong>Visual Framing:</strong> {blueprint.creator_persona.visual_description || 'Direct-to-camera presenter'}
            </p>
            <p className="field-hint">
              <strong>Delivery Cadence:</strong> {blueprint.creator_persona.voice_tone} •{' '}
              <strong>Mode:</strong> {blueprint.creator_persona.presentation_mode}
            </p>
          </div>
        </div>
      )}

      {/* Universal Visual Continuity & Object Anchor */}
      {blueprint.visual_continuity_anchor && (
        <div
          className="scene-box"
          style={{
            marginBottom: '1rem',
            borderColor: 'rgba(56, 189, 248, 0.35)',
            background: 'linear-gradient(180deg, rgba(56, 189, 248, 0.05) 0%, rgba(14, 16, 23, 0.95) 100%)',
          }}
        >
          <div className="scene-box-label" style={{ color: '#38bdf8' }}>
            <Target size={12} style={{ display: 'inline', marginRight: 4 }} />
            Universal Visual & Object Continuity Lock (Frames 1 → End)
          </div>
          <div className="scene-grid" style={{ marginTop: '0.4rem', marginBottom: 0 }}>
            {blueprint.visual_continuity_anchor.character_dna && (
              <div className="scene-box" style={{ background: 'var(--bg-obsidian)' }}>
                <div className="scene-box-label" style={{ fontSize: '0.68rem' }}>Character Continuity DNA</div>
                <p className="scene-box-text" style={{ fontSize: '0.8rem' }}>
                  {blueprint.visual_continuity_anchor.character_dna}
                </p>
              </div>
            )}
            {blueprint.visual_continuity_anchor.environment_dna && (
              <div className="scene-box" style={{ background: 'var(--bg-obsidian)' }}>
                <div className="scene-box-label" style={{ fontSize: '0.68rem' }}>Environment & World DNA</div>
                <p className="scene-box-text" style={{ fontSize: '0.8rem' }}>
                  {blueprint.visual_continuity_anchor.environment_dna}
                </p>
              </div>
            )}
          </div>
          {blueprint.visual_continuity_anchor.key_recurring_objects?.length > 0 && (
            <div style={{ marginTop: '0.45rem' }}>
              <div className="scene-box-label" style={{ fontSize: '0.68rem' }}>Locked Recurring Props & Objects:</div>
              <div className="chip-row">
                {blueprint.visual_continuity_anchor.key_recurring_objects.map((obj, i) => (
                  <span key={i} className="meta-badge cyan" style={{ fontSize: '0.73rem' }}>
                    {obj}
                  </span>
                ))}
              </div>
            </div>
          )}
          {blueprint.visual_continuity_anchor.color_palette_tokens?.length > 0 && (
            <div style={{ marginTop: '0.4rem' }}>
              <div className="scene-box-label" style={{ fontSize: '0.68rem' }}>Unified Color Palette:</div>
              <div className="chip-row">
                {blueprint.visual_continuity_anchor.color_palette_tokens.map((token, i) => (
                  <span key={i} className="meta-badge amber" style={{ fontSize: '0.7rem' }}>
                    {token}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Strategic Overview Grid */}
      <div className="scene-grid" style={{ marginBottom: '1rem' }}>
        <div className="scene-box">
          <div className="scene-box-label">
            <Target size={11} style={{ display: 'inline', marginRight: 4 }} />
            Communication Goal & Style
          </div>
          <p className="scene-box-text" style={{ marginBottom: '0.5rem' }}>
            {blueprint.goal}
          </p>
          <div className="field-hint">
            <strong>Visual Direction:</strong> {blueprint.visual_style}
          </div>
          <div className="field-hint" style={{ marginTop: '0.2rem' }}>
            <strong>Narration Style:</strong> {blueprint.narration_style}
          </div>
        </div>

        <div className="scene-box">
          <div className="scene-box-label">
            <UserCheck size={11} style={{ display: 'inline', marginRight: 4 }} />
            Audience Profile
          </div>
          <p className="scene-box-text">
            <strong>Level:</strong> {blueprint.audience?.knowledge_level} •{' '}
            <strong>Age Group:</strong> {blueprint.audience?.age_group}
          </p>
          {blueprint.audience?.interests?.length > 0 && (
            <div className="chip-row" style={{ marginTop: '0.45rem' }}>
              {blueprint.audience.interests.map((interest, idx) => (
                <span key={idx} className="meta-badge">
                  {interest}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Key Concepts & Narrative Arc */}
      <div className="scene-grid" style={{ marginBottom: '1.1rem' }}>
        <div className="scene-box">
          <div className="scene-box-label">Core Concepts</div>
          <div className="chip-row">
            {blueprint.key_concepts?.map((concept, i) => (
              <span key={i} className="meta-badge cyan">
                {concept}
              </span>
            ))}
          </div>
        </div>

        <div className="scene-box">
          <div className="scene-box-label">Narrative Arc</div>
          <div className="chip-row">
            {blueprint.narrative_structure?.map((step, i) => (
              <span key={i} className="meta-badge">
                {i + 1}. {step}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Inline Adaptation Bar */}
      <div
        className="scene-box"
        style={{
          marginBottom: '1.25rem',
          borderColor: 'rgba(245, 158, 11, 0.28)',
          background: 'rgba(245, 158, 11, 0.04)',
        }}
      >
        <div className="scene-box-label" style={{ color: '#fbbf24' }}>
          <Wand2 size={12} style={{ display: 'inline', marginRight: 5 }} />
          Instant Experience Adaptation (Preserves Content DNA ID & Increments Version)
        </div>
        <div
          style={{
            display: 'flex',
            gap: '0.6rem',
            flexWrap: 'wrap',
            marginTop: '0.4rem',
          }}
        >
          <input
            type="text"
            className="studio-input"
            style={{ flex: 1, minWidth: '240px' }}
            value={quickAdaptText}
            onChange={(e) => setQuickAdaptText(e.target.value)}
            placeholder="e.g., Adapt for executive briefing in 45 seconds..."
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={isBusy || quickAdaptText.trim().length < 5}
            onClick={() => onQuickAdaptFromBlueprint(quickAdaptText.trim())}
          >
            <Wand2 size={14} /> Adapt DNA to v{blueprint.version + 1}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={isBusy || quickAdaptText.trim().length < 5}
            onClick={() => onQuickAdaptVideoFromBlueprint(quickAdaptText.trim())}
          >
            <Video size={14} /> Adapt & Render Video v{blueprint.version + 1}
          </button>
        </div>
      </div>

      {/* Scene-by-Scene Storyboard & Veo Shot Plan */}
      <div className="card-header" style={{ marginBottom: '0.5rem' }}>
        <div className="card-title-group">
          <span className="card-kicker">SCENE & SHOT ARCHITECTURE</span>
          <h3 className="card-title" style={{ fontSize: '1.08rem' }}>
            {blueprint.scenes?.length || 0} Planned Scenes & Veo 4/6/8s Shot Breakdown
          </h3>
        </div>
      </div>

      <div className="scenes-list">
        {blueprint.scenes?.map((scene) => (
          <div key={scene.scene_number} className="scene-card">
            <div className="scene-top">
              <div>
                <div className="scene-index">
                  SCENE {String(scene.scene_number).padStart(2, '0')} •{' '}
                  {scene.duration_seconds} SECONDS
                </div>
                <h4 className="scene-title">{scene.title}</h4>
                <p className="field-hint" style={{ marginTop: '0.15rem' }}>
                  Purpose: {scene.purpose}
                </p>
              </div>

              <div className="btn-row" style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={isBusy}
                  onClick={() => onGenerateSceneNarration(scene)}
                  title="Synthesize narration audio for this scene via /api/generate-narration"
                >
                  <FileAudio size={13} /> Synthesize Audio
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={isBusy}
                  onClick={() => onSendSceneToComposer(scene)}
                  title="Send this scene number and content_id to Media & Render studio"
                >
                  <Clapperboard size={13} /> Open in Composer
                </button>
              </div>
            </div>

            <div className="scene-grid">
              <div className="scene-box">
                <div className="scene-box-label">Spoken Narration Script</div>
                <p className="scene-box-text">“{scene.narration}”</p>
              </div>

              <div className="scene-box">
                <div className="scene-box-label">Veo Visual Prompt Direction</div>
                <p className="scene-box-text">{scene.visual_description}</p>
                {scene.on_screen_text && (
                  <div className="field-hint" style={{ marginTop: '0.4rem' }}>
                    <strong>On-Screen Overlay:</strong> {scene.on_screen_text}
                  </div>
                )}
              </div>
            </div>

            {scene.shots && scene.shots.length > 0 && (
              <div>
                <div
                  className="scene-box-label"
                  style={{ marginTop: '0.85rem', marginBottom: '0.2rem' }}
                >
                  Planned Veo Shots ({scene.shots.length} clips totaling{' '}
                  {scene.shots.reduce((acc, s) => acc + s.duration_seconds, 0)}s)
                </div>
                <div className="shots-strip">
                  {scene.shots.map((shot) => (
                    <div key={shot.shot_number} className="shot-pill-card">
                      <div className="shot-pill-header">
                        <span>SHOT #{shot.shot_number} {shot.shot_type ? `• ${shot.shot_type}` : ''}</span>
                        <span>
                          {shot.duration_seconds}s • {shot.generation_method.toUpperCase()}
                        </span>
                      </div>
                      <div className="shot-pill-purpose">{shot.purpose}</div>
                      {shot.visual_action && (
                        <div className="field-hint" style={{ color: 'var(--accent-amber)', fontSize: '0.72rem' }}>
                          <strong>Action Beat:</strong> {shot.visual_action}
                        </div>
                      )}
                      <div className="shot-pill-meta">
                        <strong>Camera:</strong> {shot.camera_direction}
                      </div>
                      <div className="shot-pill-meta">
                        <strong>Motion:</strong> {shot.motion}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Learning Outcomes & Quality Checks */}
      <div className="scene-grid" style={{ marginTop: '1.15rem' }}>
        <div className="scene-box">
          <div className="scene-box-label">
            <CheckCircle2 size={11} style={{ display: 'inline', marginRight: 4 }} />
            Learning & Experience Outcomes
          </div>
          <ul style={{ paddingLeft: '1.1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            {blueprint.learning_outcomes?.map((item, idx) => (
              <li key={idx} style={{ marginBottom: '0.25rem' }}>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="scene-box">
          <div className="scene-box-label">
            <ListChecks size={11} style={{ display: 'inline', marginRight: 4 }} />
            Quality Verification Checks
          </div>
          <ul style={{ paddingLeft: '1.1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            {blueprint.quality_checks?.map((item, idx) => (
              <li key={idx} style={{ marginBottom: '0.25rem' }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
