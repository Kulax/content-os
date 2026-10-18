import React from 'react';
import {
  AlertCircle,
  BookOpen,
  GitBranch,
  ShieldCheck,
} from 'lucide-react';
import { ContentUnderstanding } from '../types/api';

interface UnderstandingCanvasProps {
  understanding: ContentUnderstanding;
}

export const UnderstandingCanvas: React.FC<UnderstandingCanvasProps> = ({
  understanding,
}) => {
  return (
    <div className="surface-card highlighted">
      <div className="card-header">
        <div className="card-title-group">
          <span className="card-kicker">SEMANTIC UNDERSTANDING ENGINE</span>
          <h2 className="card-title">Extracted Knowledge Graph & Calibrated Claims</h2>
          <p className="card-subtitle">{understanding.summary}</p>
        </div>
      </div>

      {/* Key Concepts Tags */}
      {understanding.key_concepts?.length > 0 && (
        <div className="scene-box" style={{ marginBottom: '1rem' }}>
          <div className="scene-box-label">Identified Core Concepts</div>
          <div className="chip-row">
            {understanding.key_concepts.map((c, idx) => (
              <span key={idx} className="meta-badge cyan">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Concept Definitions & Prerequisites */}
      <div className="scene-grid" style={{ marginBottom: '1rem' }}>
        <div className="scene-box">
          <div className="scene-box-label">
            <BookOpen size={11} style={{ display: 'inline', marginRight: 4 }} />
            Concept Definitions & Prerequisites
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {understanding.concepts?.map((node, idx) => (
              <div
                key={idx}
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '0.5rem',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {node.concept}
                </div>
                <div className="field-hint" style={{ color: 'var(--text-secondary)' }}>
                  {node.definition}
                </div>
                {node.prerequisites?.length > 0 && (
                  <div className="field-hint" style={{ marginTop: '0.2rem' }}>
                    Prerequisites: {node.prerequisites.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="scene-box">
          <div className="scene-box-label">
            <GitBranch size={11} style={{ display: 'inline', marginRight: 4 }} />
            Semantic Relationships (Source → Relation → Target)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {understanding.relationships?.map((rel, idx) => (
              <div
                key={idx}
                className="shot-pill-card"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.4rem',
                }}
              >
                <span className="meta-badge">{rel.source}</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    color: 'var(--accent-amber)',
                  }}
                >
                  —[{rel.relation}]→
                </span>
                <span className="meta-badge cyan">{rel.target}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Claims with Calibrated Confidence */}
      {understanding.claims?.length > 0 && (
        <div className="scene-box" style={{ marginBottom: '1rem' }}>
          <div className="scene-box-label">
            <ShieldCheck size={11} style={{ display: 'inline', marginRight: 4 }} />
            Factual Claims & Calibrated Confidence
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {understanding.claims.map((claim, idx) => {
              const pct = Math.round((claim.confidence || 0) * 100);
              return (
                <div key={idx} className="shot-pill-card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span className="shot-pill-purpose">{claim.claim}</span>
                    <span
                      className={`meta-badge ${
                        pct >= 80 ? 'emerald' : pct >= 55 ? 'amber' : 'rose'
                      }`}
                    >
                      {pct}% confidence
                    </span>
                  </div>
                  <div className="shot-pill-meta">{claim.evidence_or_context}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Uncertainty Notes */}
      {understanding.uncertainty_notes?.length > 0 && (
        <div className="diagnostic-banner warn">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: 600,
              color: '#fbbf24',
            }}
          >
            <AlertCircle size={14} /> Epistemic Uncertainty & Caveats
          </div>
          <ul style={{ paddingLeft: '1.15rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {understanding.uncertainty_notes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
