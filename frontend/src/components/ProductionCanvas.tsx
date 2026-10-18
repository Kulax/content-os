import React from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Film,
  Volume2,
  AlertTriangle,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  ComposeSceneResponse,
  CreateVideoResponse,
  GenerateNarrationResponse,
  RenderExperienceResponse,
  VideoJob,
} from '../types/api';
import { gsUriToHttpsPreviewUrl } from '../services/apiClient';
import { LivePreviewPanel } from './LivePreviewPanel';
import { VideoPreview } from './VideoPreview';

interface ProductionCanvasProps {
  apiBaseUrl: string;
  videoJob: VideoJob | null;
  videoResult: CreateVideoResponse | null;
  narrationResult: GenerateNarrationResponse | null;
  composeResult: ComposeSceneResponse | null;
  renderResult: RenderExperienceResponse | null;
  onCopyUriToRender: (uri: string, type: 'scene' | 'narration') => void;
  isBusy?: boolean;
  onRevoice?: (contentId: string, version: number, gender: 'male' | 'female') => void;
  onLocalize?: (contentId: string, version: number, language: string) => void;
}

export const ProductionCanvas: React.FC<ProductionCanvasProps> = ({
  apiBaseUrl,
  videoJob,
  videoResult,
  narrationResult,
  composeResult,
  renderResult,
  onCopyUriToRender,
  isBusy = false,
  onRevoice,
  onLocalize,
}) => {
  const statusBadgeClass = (status: string | undefined) => {
    if (!status) return '';
    if (status === 'completed') return 'emerald';
    if (status === 'skipped' || status === 'not_attempted') return 'amber';
    if (status === 'failed') return 'rose';
    return 'cyan';
  };

  const singleSceneVideoPath =
    videoResult?.captioned_scene_video_path ||
    videoResult?.narrated_scene_video_path ||
    videoResult?.scene_video_path ||
    null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      {(videoJob || videoResult) && (
        <LivePreviewPanel
          key={videoJob?.job_id ?? videoResult?.content_id}
          apiBaseUrl={apiBaseUrl}
          job={videoJob}
          result={videoResult}
          isBusy={isBusy}
          onRevoice={onRevoice}
          onLocalize={onLocalize}
        />
      )}

      {/* Create Video + Narration Pipeline Output */}
      {videoResult && (
        <div className="surface-card highlighted">
          <div className="card-header">
            <div className="card-title-group">
              <span className="card-kicker">
                COMPLETE VEO + CLOUD TTS PIPELINE • {videoResult.content_id} (v
                {videoResult.version})
              </span>
              <h2 className="card-title">
                {videoResult.scenes && videoResult.scenes.length > 1
                  ? `Full Video (${videoResult.scenes.length} Composed Scenes)`
                  : `Scene ${videoResult.scene_number}: ${videoResult.scene_title}`}
              </h2>
              <p className="card-subtitle">
                {videoResult.scenes && videoResult.scenes.length > 1
                  ? `Generated shot plans and assets for all ${videoResult.scenes.length} scenes, synthesizing narration and master composition.`
                  : `Generated Veo shots, scene composition, and narration synthesis.`}
              </p>
            </div>

            <div className="badge-row">
              <span className={`meta-badge ${statusBadgeClass(videoResult.status)}`}>
                Pipeline: {videoResult.status}
              </span>
              {videoResult.final_video_uri && (
                <span className="meta-badge emerald">
                  <CheckCircle2 size={12} /> Master Video Composed
                </span>
              )}
            </div>
          </div>

          {/* Master Full Video Output (if composed across all scenes) */}
          {videoResult.final_video_uri && (
            <div
              className="scene-box"
              style={{
                marginBottom: '1rem',
                background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, rgba(14, 16, 23, 0.95) 100%)',
                borderColor: 'rgba(16, 185, 129, 0.4)',
              }}
            >
              <div className="scene-box-label" style={{ color: '#34d399', fontSize: '0.8rem' }}>
                <Film size={14} style={{ display: 'inline', marginRight: 5 }} />
                Complete Master Video Experience (All Scenes Stitched)
              </div>
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  color: 'var(--accent-emerald)',
                  display: 'block',
                  margin: '0.4rem 0',
                  wordBreak: 'break-all',
                }}
              >
                {videoResult.final_video_uri}
              </code>
              <p className="field-hint" style={{ color: '#a7f3d0' }}>
                {videoResult.render_message || 'Full video rendered successfully across all planned scenes.'}
              </p>
            </div>
          )}

          {/* Multi-Scene Breakdown or Single Scene View */}
          {videoResult.scenes && videoResult.scenes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="scene-box-label">
                Scene-by-Scene Generated Assets ({videoResult.scenes.length} Scenes)
              </div>
              {videoResult.scenes.map((sc) => (
                <div key={sc.scene_number} className="scene-card" style={{ padding: '0.9rem' }}>
                  <div className="scene-top" style={{ marginBottom: '0.4rem' }}>
                    <div>
                      <div className="scene-index">
                        SCENE {sc.scene_number} • {sc.duration_seconds}s
                      </div>
                      <h4 className="scene-title" style={{ fontSize: '0.98rem' }}>
                        {sc.scene_title}
                      </h4>
                    </div>

                    <div className="badge-row" style={{ marginTop: 0 }}>
                      <span className={`meta-badge ${statusBadgeClass(sc.composition_status)}`}>
                        Comp: {sc.composition_status}
                      </span>
                      <span className={`meta-badge ${statusBadgeClass(sc.narration_status)}`}>
                        Audio: {sc.narration_status}
                      </span>
                      {sc.caption_status && (
                        <span
                          className={`meta-badge ${statusBadgeClass(sc.caption_status)}`}
                          title={sc.caption_message || undefined}
                        >
                          Captions: {sc.caption_status}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="scene-grid" style={{ marginTop: '0.5rem' }}>
                    <div className="scene-box">
                      <div className="scene-box-label">Scene Video / Composed MP4</div>
                      <code style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>
                        {sc.captioned_scene_video_path || sc.narrated_scene_video_path || sc.scene_video_path || 'Shot composition skipped (FFmpeg required)'}
                      </code>
                    </div>

                    <div className="scene-box">
                      <div className="scene-box-label">Narration Audio URI</div>
                      <code style={{ fontSize: '0.72rem', color: 'var(--accent-amber)', wordBreak: 'break-all' }}>
                        {sc.narration_audio_uri || 'Narration not synthesized'}
                      </code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Fallback single-scene view */
            <div className="scene-grid" style={{ marginBottom: '1rem' }}>
                <div className="scene-box">
                  <div className="scene-box-label">Narrated / Composed Scene Video</div>
                  {singleSceneVideoPath ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <code
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.73rem',
                          color: 'var(--accent-cyan)',
                          wordBreak: 'break-all',
                        }}
                      >
                        {singleSceneVideoPath}
                      </code>
                      <div className="btn-row" style={{ marginTop: 0 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onCopyUriToRender(singleSceneVideoPath, 'scene')}
                        >
                        <Copy size={12} /> Add to Final Render Timeline
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="field-hint">
                    No single stitched scene MP4 generated (individual Veo shots generated below).
                  </p>
                )}
              </div>

              <div className="scene-box">
                <div className="scene-box-label">Narration Audio Asset</div>
                {videoResult.narration_audio_uri ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <code
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.73rem',
                        color: 'var(--accent-amber)',
                        wordBreak: 'break-all',
                      }}
                    >
                      {videoResult.narration_audio_uri}
                    </code>
                    <div className="btn-row" style={{ marginTop: 0 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onCopyUriToRender(videoResult.narration_audio_uri!, 'narration')}
                      >
                        <Volume2 size={12} /> Use in Final Render
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="field-hint">No narration audio URI produced.</p>
                )}
              </div>
            </div>
          )}

          {/* Generated Shot Assets List */}
          <div className="scene-box-label">
            Generated Veo Shot Assets ({videoResult.shot_assets?.length || 0})
          </div>
          <div className="shots-strip">
            {videoResult.shot_assets?.map((asset) => {
              const httpsUrl = gsUriToHttpsPreviewUrl(asset.video_path);
              return (
                <div key={asset.shot_number} className="shot-pill-card">
                  <div className="shot-pill-header">
                    <span>SHOT #{asset.shot_number}</span>
                    <span>
                      {asset.duration_seconds}s • {asset.generation_method}
                    </span>
                  </div>
                  <code
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.69rem',
                      color: 'var(--text-secondary)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {asset.video_path}
                  </code>
                  <div className="btn-row" style={{ marginTop: '0.35rem' }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        navigator.clipboard.writeText(asset.video_path)
                      }
                    >
                      <Copy size={11} /> Copy gs://
                    </button>
                    {httpsUrl && (
                      <a
                        href={httpsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost btn-sm"
                      >
                        <ExternalLink size={11} /> GCS Link
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Standalone Narration Output */}
      {narrationResult && (
        <div className="surface-card">
          <div className="card-header">
            <div className="card-title-group">
              <span className="card-kicker">CLOUD TEXT-TO-SPEECH NARRATION</span>
              <h3 className="card-title">
                Scene {narrationResult.scene_number} Narration Audio
              </h3>
            </div>
            <span className={`meta-badge ${statusBadgeClass(narrationResult.status)}`}>
              {narrationResult.status}
            </span>
          </div>
          <code
            style={{
              display: 'block',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.76rem',
              color: 'var(--accent-amber)',
              marginBottom: '0.65rem',
              wordBreak: 'break-all',
            }}
          >
            {narrationResult.audio_uri}
          </code>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onCopyUriToRender(narrationResult.audio_uri, 'narration')}
          >
            <Volume2 size={13} /> Use Audio URI in Final Render
          </button>
        </div>
      )}

      {/* Standalone Scene Composition Output */}
      {composeResult && (
        <div className="surface-card">
          <div className="card-header">
            <div className="card-title-group">
              <span className="card-kicker">SCENE COMPOSER</span>
              <h3 className="card-title">
                Scene {composeResult.scene_number} Composition
              </h3>
              <p className="card-subtitle">{composeResult.composition_message}</p>
            </div>
            <span
              className={`meta-badge ${statusBadgeClass(
                composeResult.composition_status
              )}`}
            >
              {composeResult.composition_status}
            </span>
          </div>
          {composeResult.scene_video_path && (
            <div>
              <VideoPreview apiBaseUrl={apiBaseUrl} gsUri={composeResult.scene_video_path} />
              <code
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.76rem',
                  color: 'var(--accent-cyan)',
                  marginBottom: '0.65rem',
                  wordBreak: 'break-all',
                }}
              >
                {composeResult.scene_video_path}
              </code>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  onCopyUriToRender(composeResult.scene_video_path!, 'scene')
                }
              >
                <Layers size={13} /> Add Scene URI to Final Render
              </button>
            </div>
          )}
        </div>
      )}

      {/* Final Render Experience Output */}
      {renderResult && (
        <div className="surface-card highlighted">
          <div className="card-header">
            <div className="card-title-group">
              <span className="card-kicker">
                FINAL EXPERIENCE RENDER
              </span>
              <h3 className="card-title">Master Experience Artifact</h3>
              <p className="card-subtitle">{renderResult.render_message}</p>
            </div>
            <span
              className={`meta-badge ${statusBadgeClass(renderResult.render_status)}`}
            >
              {renderResult.render_status}
            </span>
            {renderResult.caption_status && renderResult.caption_status !== 'not_requested' && (
              <span
                className={`meta-badge ${statusBadgeClass(renderResult.caption_status)}`}
                title={renderResult.caption_message || undefined}
              >
                Captions: {renderResult.caption_status}
              </span>
            )}
          </div>

          <div className="scene-grid">
            <div className="scene-box">
              <div className="scene-box-label">Final Video URI</div>
              <VideoPreview apiBaseUrl={apiBaseUrl} gsUri={renderResult.final_video_uri} />
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.74rem',
                  color: 'var(--accent-emerald)',
                  wordBreak: 'break-all',
                }}
              >
                {renderResult.final_video_uri || 'None (FFmpeg required)'}
              </code>
            </div>

            <div className="scene-box">
              <div className="scene-box-label">Subtitle SRT URI</div>
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.74rem',
                  color: 'var(--accent-cyan)',
                  wordBreak: 'break-all',
                }}
              >
                {renderResult.subtitle_uri || 'Not requested'}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
