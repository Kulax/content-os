import React from 'react';
import {
  ArrowUpRight,
  Flame,
  Lightbulb,
  Play,
  Sparkles,
  ThumbsUp,
  Eye,
  MessageSquare,
  AlertTriangle,
  Video,
  CheckCircle2,
  Clock,
  Compass,
  User,
  Zap,
} from 'lucide-react';
import {
  CreateRequest,
  TrendIdea,
  TrendIdeationResponse,
  YouTubeTrendIdeationResponse,
} from '../types/api';

interface TrendCanvasProps {
  trendResult: TrendIdeationResponse;
  youtubeResult: YouTubeTrendIdeationResponse | null;
  onLoadIdeaIntoCreate: (req: CreateRequest, autoAction?: 'dna' | 'video') => void;
  isBusy: boolean;
}

export const TrendCanvas: React.FC<TrendCanvasProps> = ({
  trendResult,
  youtubeResult,
  onLoadIdeaIntoCreate,
  isBusy,
}) => {
  const buildIdeaCreateRequest = (idea: TrendIdea): CreateRequest => {
    const baseTop = trendResult.top_create_request;
    return {
      prompt: idea.create_prompt,
      audience_level: baseTop?.audience_level || 'general',
      duration_seconds: baseTop?.duration_seconds || 120,
      language: baseTop?.language || 'English',
      format: 'video',
      tone: baseTop?.tone || 'engaging',
      creator_persona: idea.creator_persona || null,
    };
  };

  return (
    <div className="surface-card highlighted">
      <div className="card-header">
        <div className="card-title-group">
          <span className="card-kicker">
            {youtubeResult
              ? `LIVE YOUTUBE TREND INTELLIGENCE • ${youtubeResult.resolved_category.toUpperCase()} (${youtubeResult.region_code})`
              : 'AI TREND SYNTHESIS & IDEATION'}
          </span>
          <h2 className="card-title">Trend Radar & Actionable Creator Angles</h2>
          <p className="card-subtitle">{trendResult.summary}</p>
        </div>

        {trendResult.top_create_request?.prompt && (
          <div className="btn-row" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={isBusy}
              onClick={() => onLoadIdeaIntoCreate(trendResult.top_create_request)}
            >
              Load Top Idea in Composer
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={isBusy}
              onClick={() =>
                onLoadIdeaIntoCreate(trendResult.top_create_request, 'dna')
              }
            >
              <Sparkles size={13} /> Instant Create DNA
            </button>
            <button
              type="button"
              className="btn btn-cyan btn-sm"
              disabled={isBusy}
              onClick={() =>
                onLoadIdeaIntoCreate(trendResult.top_create_request, 'video')
              }
            >
              <Video size={13} /> Instant Create Video
            </button>
          </div>
        )}
      </div>

      {/* Top Insights */}
      {trendResult.top_insights?.length > 0 && (
        <div className="scene-box" style={{ marginBottom: '1.1rem' }}>
          <div className="scene-box-label">
            <Lightbulb size={12} style={{ display: 'inline', marginRight: 5 }} />
            Key Cultural & Format Signals
          </div>
          <ul
            style={{
              paddingLeft: '1.15rem',
              color: 'var(--text-primary)',
              fontSize: '0.84rem',
              display: 'grid',
              gap: '0.35rem',
            }}
          >
            {trendResult.top_insights.map((insight, idx) => (
              <li key={idx}>{insight}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Ranked Content Ideas */}
      <div className="card-title-group" style={{ marginBottom: '0.5rem' }}>
        <span className="card-kicker">STEP-BY-STEP CREATOR BLUEPRINTS</span>
        <h3 className="card-title" style={{ fontSize: '1.08rem' }}>
          {trendResult.ideas?.length || 0} Ranked Video Ideas with Actionable Execution Plans
        </h3>
      </div>

      <div className="idea-cards-stack">
        {trendResult.ideas?.map((idea, index) => {
          const ideaReq = buildIdeaCreateRequest(idea);
          return (
            <div
              key={index}
              className={`idea-card ${index === 0 ? 'top-pick' : ''}`}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div className="badge-row" style={{ marginBottom: '0.35rem' }}>
                    <span className="meta-badge amber">
                      <Flame size={11} />{' '}
                      {index === 0 ? 'TOP RECOMMENDED IDEA' : `IDEA #${index + 1}`}
                    </span>
                    <span className="meta-badge cyan">{idea.audience_fit}</span>
                    {idea.creator_persona && (
                      <span className="meta-badge emerald">
                        <User size={11} /> Featuring: {idea.creator_persona.name}
                      </span>
                    )}
                  </div>
                  <h4 className="scene-title">{idea.title}</h4>
                </div>

                <div className="btn-row" style={{ marginTop: 0 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={isBusy}
                    onClick={() => onLoadIdeaIntoCreate(ideaReq)}
                  >
                    Prefill Create
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={isBusy}
                    onClick={() => onLoadIdeaIntoCreate(ideaReq, 'dna')}
                  >
                    <Sparkles size={12} /> Generate DNA
                  </button>
                  <button
                    type="button"
                    className="btn btn-cyan btn-sm"
                    disabled={isBusy}
                    onClick={() => onLoadIdeaIntoCreate(ideaReq, 'video')}
                  >
                    <Play size={12} /> Generate Video
                  </button>
                </div>
              </div>

              <p className="scene-box-text" style={{ color: 'var(--text-secondary)' }}>
                <strong>Why it’s trending:</strong> {idea.why_trending}
              </p>

              {/* ACTIONABLE CREATOR EXECUTION MAP */}
              {idea.execution_plan ? (
                <div
                  className="scene-box"
                  style={{
                    background: 'rgba(56, 189, 248, 0.04)',
                    borderColor: 'rgba(56, 189, 248, 0.28)',
                  }}
                >
                  <div
                    className="scene-box-label"
                    style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <Zap size={12} /> Creator Action Map • {idea.execution_plan.target_format} •{' '}
                    <Clock size={11} /> {idea.execution_plan.setup_time_minutes}m setup
                  </div>

                  <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <div style={{ fontSize: '0.84rem' }}>
                      <strong style={{ color: '#fbbf24' }}>Opening Hook (Say this in first 3s):</strong>{' '}
                      “{idea.execution_plan.hook_sentence}”
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <strong>Key Core Value:</strong> {idea.execution_plan.key_takeaway}
                    </div>

                    {idea.execution_plan.step_by_step_workflow?.length > 0 && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <div className="scene-box-label" style={{ fontSize: '0.68rem' }}>
                          Step-by-step workflow:
                        </div>
                        <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.2rem' }}>
                          {idea.execution_plan.step_by_step_workflow.map((st) => (
                            <div
                              key={st.step_number}
                              className="shot-pill-card"
                              style={{
                                padding: '0.4rem 0.6rem',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.5rem',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <span className="meta-badge" style={{ padding: '0.1rem 0.35rem' }}>
                                  #{st.step_number} {st.phase}
                                </span>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                                  {st.action}
                                </span>
                              </div>
                              <span className="field-hint">{st.why_it_matters}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ fontSize: '0.8rem', color: '#34d399', marginTop: '0.2rem' }}>
                      <strong>Call to Action:</strong> “{idea.execution_plan.call_to_action}”
                    </div>
                  </div>
                </div>
              ) : (
                <div className="scene-grid">
                  <div className="scene-box">
                    <div className="scene-box-label">Recommended Hook & Angle</div>
                    <p className="scene-box-text" style={{ marginBottom: '0.35rem' }}>
                      <strong>Hook:</strong> “{idea.recommended_hook}”
                    </p>
                    <p className="field-hint">
                      <strong>Angle:</strong> {idea.content_angle}
                    </p>
                  </div>

                  <div className="scene-box">
                    <div className="scene-box-label">Key Talking Points</div>
                    <ul
                      style={{
                        paddingLeft: '1.1rem',
                        fontSize: '0.8rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {idea.key_points?.map((pt, i) => (
                        <li key={i} style={{ marginBottom: '0.2rem' }}>
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {idea.risk_notes?.length > 0 && (
                <div className="field-hint" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <AlertTriangle size={12} color="#f59e0b" />
                  <span>
                    <strong>Creator Tip:</strong> {idea.risk_notes.join(' • ')}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live YouTube Fetched Videos Grid */}
      {youtubeResult && youtubeResult.trending_videos?.length > 0 && (
        <div style={{ marginTop: '1.4rem' }}>
          <div className="card-title-group">
            <span className="card-kicker">
              SOURCE SIGNALS • {youtubeResult.fetched_count} TRENDING YOUTUBE VIDEOS
            </span>
            <h3 className="card-title" style={{ fontSize: '1.05rem' }}>
              {youtubeResult.source_note?.startsWith("YouTube's most popular")
                ? 'Fetched YouTube Most Popular Feed'
                : 'Most-Viewed Recent YouTube Videos'}
            </h3>
            {youtubeResult.source_note && <p className="field-hint">{youtubeResult.source_note}</p>}
          </div>

          <div className="yt-videos-grid">
            {youtubeResult.trending_videos.map((v) => (
              <div key={v.video_id} className="yt-video-card">
                <div className="yt-thumb-wrap">
                  <img
                    className="yt-thumb"
                    src={`https://i.ytimg.com/vi/${v.video_id}/hqdefault.jpg`}
                    alt={v.title}
                    loading="lazy"
                  />
                </div>
                <div className="yt-body">
                  <a
                    href={v.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="yt-title"
                    title={v.title}
                  >
                    {v.title} <ArrowUpRight size={11} style={{ display: 'inline' }} />
                  </a>
                  <span className="yt-channel">{v.channel_title}</span>
                  <div className="yt-stats">
                    {v.view_count != null && (
                      <span>
                        <Eye size={10} style={{ display: 'inline', marginRight: 2 }} />
                        {Number(v.view_count).toLocaleString()}
                      </span>
                    )}
                    {v.like_count != null && (
                      <span>
                        <ThumbsUp size={10} style={{ display: 'inline', marginRight: 2 }} />
                        {Number(v.like_count).toLocaleString()}
                      </span>
                    )}
                    {v.comment_count != null && (
                      <span>
                        <MessageSquare
                          size={10}
                          style={{ display: 'inline', marginRight: 2 }}
                        />
                        {Number(v.comment_count).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
