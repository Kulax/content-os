import React, { useState } from 'react';
import { Loader2, RotateCcw, Wand2 } from 'lucide-react';
import { contentOsApi } from '../services/apiClient';
import { RefineField } from '../types/api';

interface RefineButtonProps {
  apiBaseUrl: string;
  field: RefineField;
  value: string;
  onChange: (value: string) => void;
  context?: Record<string, string | number | boolean | null | undefined>;
  disabled?: boolean;
}

/** "Refine with AI" action for a text field: rewrites it with Gemini and offers Undo. */
export const RefineButton: React.FC<RefineButtonProps> = ({
  apiBaseUrl,
  field,
  value,
  onChange,
  context = {},
  disabled = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [original, setOriginal] = useState<string | null>(null);
  const [refined, setRefined] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Undo only applies while the field still holds the refined text.
  const canUndo = original !== null && refined === value;

  const refine = async () => {
    setLoading(true);
    setError(null);
    try {
      const cleanContext = Object.fromEntries(
        Object.entries(context)
          .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
          .map(([k, v]) => [k, String(v)])
      );
      const result = await contentOsApi.refinePrompt(apiBaseUrl, { field, text: value, context: cleanContext });
      setOriginal(value);
      setRefined(result.refined);
      setNotes(result.notes);
      onChange(result.refined);
    } catch (err) {
      setError((err as Error)?.message || 'Refinement failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="refine-actions">
      {error && (
        <span className="refine-error" title={error}>
          Refine failed
        </span>
      )}
      {canUndo && (
        <button
          type="button"
          className="refine-btn ghost"
          onClick={() => {
            onChange(original!);
            setOriginal(null);
            setRefined(null);
          }}
          title="Restore your original text"
        >
          <RotateCcw size={11} /> Undo
        </button>
      )}
      <button
        type="button"
        className="refine-btn"
        disabled={disabled || loading || value.trim().length < 3}
        onClick={refine}
        title={canUndo && notes ? `Refined: ${notes}` : 'Rewrite this into a stronger prompt with Gemini'}
      >
        {loading ? <Loader2 size={11} className="spin" /> : <Wand2 size={11} />}
        {loading ? 'Refining…' : canUndo ? 'Refine again' : 'Refine with AI'}
      </button>
    </span>
  );
};
