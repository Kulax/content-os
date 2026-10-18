import React from 'react';
import { PresetOption } from '../constants';

const CUSTOM_VALUE = '__custom__';

interface PresetSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: PresetOption[];
  customPlaceholder?: string;
}

/** Dropdown of presets plus a "Custom…" choice that reveals a free-text input. */
export const PresetSelect: React.FC<PresetSelectProps> = ({ id, value, onChange, options, customPlaceholder }) => {
  const isPreset = options.some((option) => option.value === value);

  return (
    <div className="preset-select">
      <select
        id={id}
        className="studio-select"
        value={isPreset ? value : CUSTOM_VALUE}
        onChange={(e) => onChange(e.target.value === CUSTOM_VALUE ? '' : e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        <option value={CUSTOM_VALUE}>Custom…</option>
      </select>
      {!isPreset && (
        <input
          type="text"
          className="studio-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={customPlaceholder || 'Type your own'}
          aria-label={`${id} custom value`}
          autoFocus={value === ''}
        />
      )}
    </div>
  );
};
