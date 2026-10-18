import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { mediaPreviewUrl } from '../services/apiClient';

interface VideoPreviewProps {
  apiBaseUrl: string;
  gsUri: string | null | undefined;
  compact?: boolean;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ apiBaseUrl, gsUri, compact = false }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = mediaPreviewUrl(apiBaseUrl, gsUri);

  if (!src) return null;

  // "#t=0.1" makes the browser decode a frame to show instead of a black box before playback.
  const playableSrc = `${src}#t=0.1`;

  if (failedSrc === src) {
    return (
      <div className="video-preview-error">
        <AlertTriangle size={14} /> Preview unavailable. Check that the backend can read the output bucket.
      </div>
    );
  }

  return (
    <video
      key={src}
      className={`video-preview ${compact ? 'compact' : ''}`}
      src={playableSrc}
      controls
      playsInline
      preload="auto"
      onError={() => setFailedSrc(src)}
    />
  );
};
