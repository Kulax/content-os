import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Film, Globe, Loader2, Mic, MonitorPlay, User } from 'lucide-react';
import { LOCALIZATION_LANGUAGES } from '../constants';
import { CreateVideoResponse, Localization, SceneVideoOutput, VideoJob } from '../types/api';
import { VideoPreview } from './VideoPreview';

interface LivePreviewPanelProps {
  apiBaseUrl: string;
  job: VideoJob | null;
  result: CreateVideoResponse | null;
  isBusy?: boolean;
  onRevoice?: (contentId: string, version: number, gender: 'male' | 'female') => void;
  onLocalize?: (contentId: string, version: number, language: string) => void;
}

type ViewerSelection = 'final' | number | `lang:${string}`;

const localizationKey = (localization: Localization) => localization.language_code || localization.language;

const scenePreviewUri = (scene: SceneVideoOutput): string | null =>
  scene.preview_video_path ||
  scene.captioned_scene_video_path ||
  scene.narrated_scene_video_path ||
  scene.scene_video_path ||
  scene.shot_assets?.[0]?.video_path ||
  null;

export const LivePreviewPanel: React.FC<LivePreviewPanelProps> = ({
  apiBaseUrl,
  job,
  result,
  isBusy = false,
  onRevoice,
  onLocalize,
}) => {
  const [manualSelection, setManualSelection] = useState<ViewerSelection | null>(null);
  const [revoiceGender, setRevoiceGender] = useState<'male' | 'female'>('male');
  const [localizeLanguage, setLocalizeLanguage] = useState<string>('');

  const scenes: SceneVideoOutput[] = result?.scenes ?? job?.scenes ?? [];
  const localizations: Localization[] = result?.localizations ?? job?.localizations ?? [];
  const finalUri = result?.final_video_uri ?? job?.final_video_uri ?? null;
  const totalScenes = job?.total_scenes || result?.total_scenes || scenes.length;
  const isRunning = job?.status === 'queued' || job?.status === 'running';
  const failed = job?.status === 'failed';
  const faceUsed = result?.face_reference_used ?? job?.face_reference_used ?? false;
  const title = job?.title || result?.blueprint?.title || result?.scene_title || 'Video draft';
  const version = job?.version ?? result?.version ?? null;
  const contentId = job?.content_id || result?.content_id || null;
  const voiceName =
    result?.narration_voice_name || scenes.find((scene) => scene.narration_voice_name)?.narration_voice_name || null;
  const canRevoice = !!onRevoice && !!contentId && !!version && !!result && !isRunning;
  const primaryLanguage = result?.blueprint?.language || null;
  const doneLanguages = new Set(
    localizations.filter((loc) => loc.final_video_uri).map((loc) => loc.language.toLowerCase())
  );
  const localizableLanguages = LOCALIZATION_LANGUAGES.filter(
    (lang) => lang.toLowerCase() !== (primaryLanguage || '').toLowerCase() && !doneLanguages.has(lang.toLowerCase())
  );
  const chosenLocalizeLanguage = localizableLanguages.includes(localizeLanguage)
    ? localizeLanguage
    : localizableLanguages[0] || '';
  const canLocalize = !!onLocalize && canRevoice && localizableLanguages.length > 0;
  const failedLocalizations = localizations.filter((loc) => !loc.final_video_uri);

  const totalShots = job?.total_shots ?? 0;
  const completedShots = job?.completed_shots ?? 0;
  const progressPercent = !job
    ? 100
    : job.status === 'completed'
    ? 100
    : totalShots > 0
    ? Math.min(95, Math.round((completedShots / totalShots) * 90) + scenes.length)
    : 3;

  // Follow the newest asset unless the user picked something to watch.
  const latestScene = scenes[scenes.length - 1];
  const autoSelection: ViewerSelection | null = finalUri ? 'final' : latestScene ? latestScene.scene_number : null;
  const selection = manualSelection ?? autoSelection;
  const selectedScene = typeof selection === 'number' ? scenes.find((s) => s.scene_number === selection) : undefined;
  const selectedLocalization =
    typeof selection === 'string' && selection.startsWith('lang:')
      ? localizations.find((loc) => `lang:${localizationKey(loc)}` === selection)
      : undefined;
  const viewerUri =
    selection === 'final'
      ? finalUri
      : selectedLocalization
      ? selectedLocalization.final_video_uri
      : selectedScene
      ? scenePreviewUri(selectedScene)
      : null;

  const pendingSceneNumbers = Array.from({ length: Math.max(totalScenes - scenes.length, 0) }, (_, i) => scenes.length + i + 1);

  return (
    <div className="surface-card highlighted">
      <div className="card-header">
        <div className="card-title-group">
          <span className="card-kicker">
            <MonitorPlay size={12} style={{ display: 'inline', marginRight: 4 }} />
            LIVE PREVIEW {job?.content_id || result?.content_id ? `• ${job?.content_id || result?.content_id}` : ''}
            {version ? ` • v${version}` : ''}
          </span>
          <h2 className="card-title">{title}</h2>
          <p className="card-subtitle">
            {failed ? job?.error : job?.message || 'Preview each scene and the stitched final draft.'}
          </p>
        </div>
        <div className="badge-row">
          <span className={`meta-badge ${failed ? 'rose' : isRunning ? 'cyan' : 'emerald'}`}>
            {isRunning ? <Loader2 size={12} className="spin" /> : failed ? null : <CheckCircle2 size={12} />}{' '}
            {job?.status ?? 'completed'}
          </span>
          {faceUsed && (
            <span className="meta-badge emerald" title="Host shots were generated from your uploaded photo.">
              <User size={12} /> Your face
            </span>
          )}
          {voiceName && (
            <span className="meta-badge cyan" title="Text-to-speech voice used for the narration">
              <Mic size={12} /> {voiceName.split('-').slice(-1)[0]}
            </span>
          )}
        </div>
      </div>

      {(canRevoice || canLocalize) && (
        <div className="live-revoice">
          {canRevoice && (
            <div className="live-tool">
              <span className="field-hint">Wrong narrator voice? Re-voice using the same footage (no new Veo shots):</span>
              <div className="live-revoice-controls">
                <select
                  className="studio-select"
                  value={revoiceGender}
                  onChange={(e) => setRevoiceGender(e.target.value as 'male' | 'female')}
                  aria-label="Narrator voice"
                >
                  <option value="male">Male voice</option>
                  <option value="female">Female voice</option>
                </select>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={isBusy}
                  onClick={() => onRevoice!(contentId!, version!, revoiceGender)}
                >
                  <Mic size={13} /> Re-voice v{version}
                </button>
              </div>
            </div>
          )}
          {canLocalize && (
            <div className="live-tool">
              <span className="field-hint">Add a dubbed version (translated narration and captions, same footage):</span>
              <div className="live-revoice-controls">
                <select
                  className="studio-select"
                  value={chosenLocalizeLanguage}
                  onChange={(e) => setLocalizeLanguage(e.target.value)}
                  aria-label="Language for the dubbed version"
                >
                  {localizableLanguages.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={isBusy || !chosenLocalizeLanguage}
                  onClick={() => onLocalize!(contentId!, version!, chosenLocalizeLanguage)}
                >
                  <Globe size={13} /> Add {chosenLocalizeLanguage} version
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {failedLocalizations.length > 0 && !isRunning && (
        <div className="video-preview-error" style={{ marginBottom: '0.9rem' }}>
          <AlertTriangle size={14} />
          {failedLocalizations.map((loc) => `${loc.language}: ${loc.error || 'failed'}`).join(' | ')}
        </div>
      )}

      {job && (
        <div className="live-progress">
          <div className="live-progress-track">
            <div className={`live-progress-fill ${failed ? 'failed' : ''}`} style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="live-progress-meta">
            <span>
              Shots {completedShots}/{totalShots || '?'}
            </span>
            <span>
              Scenes {scenes.length}/{totalScenes || '?'}
            </span>
            <span>{finalUri ? 'Final draft ready' : 'Final draft pending'}</span>
          </div>
        </div>
      )}

      <div className="live-viewer">
        <div className="live-viewer-tabs">
          <button
            type="button"
            className={`preset-chip ${selection === 'final' ? 'active' : ''}`}
            disabled={!finalUri}
            onClick={() => setManualSelection('final')}
          >
            <Film size={11} /> Final draft{primaryLanguage ? ` (${primaryLanguage})` : ''}
          </button>
          {localizations
            .filter((loc) => loc.final_video_uri)
            .map((loc) => (
              <button
                key={`lang-${localizationKey(loc)}`}
                type="button"
                className={`preset-chip ${selection === `lang:${localizationKey(loc)}` ? 'active' : ''}`}
                onClick={() => setManualSelection(`lang:${localizationKey(loc)}`)}
                title={loc.title || undefined}
              >
                <Globe size={11} /> {loc.language}
              </button>
            ))}
          {scenes.map((scene) => (
            <button
              key={scene.scene_number}
              type="button"
              className={`preset-chip ${selection === scene.scene_number ? 'active' : ''}`}
              onClick={() => setManualSelection(scene.scene_number)}
            >
              Scene {scene.scene_number}
            </button>
          ))}
          {manualSelection !== null && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setManualSelection(null)}>
              Follow latest
            </button>
          )}
        </div>

        {viewerUri ? (
          <VideoPreview apiBaseUrl={apiBaseUrl} gsUri={viewerUri} />
        ) : (
          <div className="live-viewer-placeholder">
            {isRunning ? <Loader2 size={22} className="spin" /> : <Clock size={22} />}
            <span>
              {isRunning
                ? 'The first scene will appear here as soon as it is rendered.'
                : failed
                ? 'No previewable scenes were produced.'
                : 'No preview available.'}
            </span>
          </div>
        )}
      </div>

      {(scenes.length > 0 || pendingSceneNumbers.length > 0) && (
        <div className="live-scene-grid">
          {scenes.map((scene) => (
            <div key={scene.scene_number} className="live-scene-card">
              <div className="live-scene-card-header">
                <span>
                  SCENE {scene.scene_number} • {scene.duration_seconds}s
                </span>
                {scene.caption_status === 'completed' && <span className="meta-badge emerald">CC</span>}
              </div>
              <div className="live-scene-title">{scene.scene_title}</div>
              <VideoPreview apiBaseUrl={apiBaseUrl} gsUri={scenePreviewUri(scene)} compact />
            </div>
          ))}
          {isRunning &&
            pendingSceneNumbers.map((sceneNumber, index) => (
              <div key={`pending-${sceneNumber}`} className="live-scene-card pending">
                <div className="live-scene-card-header">
                  <span>SCENE {sceneNumber}</span>
                </div>
                <div className="live-viewer-placeholder compact">
                  {index === 0 ? <Loader2 size={16} className="spin" /> : <Clock size={16} />}
                  <span>{index === 0 ? 'Rendering…' : 'Queued'}</span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
