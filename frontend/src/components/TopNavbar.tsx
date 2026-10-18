import React from 'react';
import {
  Sparkles,
  TrendingUp,
  Layers,
  Network,
  Film,
} from 'lucide-react';

export type StudioMode =
  | 'create'
  | 'trends'
  | 'transform'
  | 'understand'
  | 'production';

interface TopNavbarProps {
  activeMode: StudioMode;
  onSelectMode: (mode: StudioMode) => void;
  healthStatus: 'online' | 'offline' | 'checking';
  gcpProject: string | null;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  activeMode,
  onSelectMode,
  healthStatus,
  gcpProject,
}) => {
  const modes: { id: StudioMode; label: string; icon: React.ReactNode }[] = [
    { id: 'create', label: 'Create & DNA', icon: <Sparkles size={15} /> },
    { id: 'trends', label: 'Trend Radar', icon: <TrendingUp size={15} /> },
    { id: 'transform', label: 'Transform & Adapt', icon: <Layers size={15} /> },
    { id: 'understand', label: 'Semantic Graph', icon: <Network size={15} /> },
    { id: 'production', label: 'Media & Render', icon: <Film size={15} /> },
  ];

  return (
    <header className="topbar">
      <div className="brand-cluster">
        <div className="brand-mark" aria-hidden="true">
          <Sparkles size={18} />
        </div>
        <div className="brand-titles">
          <div className="brand-name-row">
            <span className="brand-name">CONTENT OS</span>
            <span className="brand-tag">STUDIO v0.2</span>
          </div>
          <span className="brand-motto">
            One piece of content. Infinite ways to experience it.
          </span>
        </div>
      </div>

      <nav className="nav-modes" aria-label="Studio Workspace Modes">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`nav-mode-btn ${activeMode === m.id ? 'active' : ''}`}
            onClick={() => onSelectMode(m.id)}
          >
            {m.icon}
            <span>{m.label}</span>
          </button>
        ))}
      </nav>

      <div className="runtime-cluster">
        <div
          className="status-pill"
          title={
            gcpProject
              ? `Connected to GCP Project: ${gcpProject}`
              : 'Backend connection status'
          }
        >
          <span className={`status-dot ${healthStatus}`} />
          <span>
            {healthStatus === 'online'
              ? gcpProject || 'API Online'
              : healthStatus === 'checking'
              ? 'Checking...'
              : 'API Offline'}
          </span>
        </div>
      </div>
    </header>
  );
};
