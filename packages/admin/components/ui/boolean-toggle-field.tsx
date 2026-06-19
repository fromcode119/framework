"use client";

import React from 'react';
import { Switch } from './switch';
import type { BooleanToggleFieldProps } from './boolean-toggle-field.interfaces';

/**
 * Standard presentation for a boolean collection field: a full-width bordered row that fills its
 * grid cell (so the toggle never floats lonely under its label), showing the current Yes/No state
 * on the left and the {@link Switch} on the right. Used by both the top-level FieldRenderer and the
 * ArrayField sub-field renderer so every boolean looks identical and intentional.
 */
export class BooleanToggleField extends React.Component<BooleanToggleFieldProps> {
  render(): React.ReactNode {
    const { checked, onChange, disabled, theme } = this.props;
    const isDark = theme === 'dark';
    return (
      <div
        className={`flex h-10 w-full items-center justify-between gap-3 rounded-lg border px-3 transition-colors ${
          isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'
        } ${disabled ? 'opacity-70' : ''}`}
      >
        <span className={`text-xs font-semibold ${checked ? 'text-indigo-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {checked ? 'Yes' : 'No'}
        </span>
        <Switch checked={checked} onChange={onChange} disabled={disabled} />
      </div>
    );
  }
}
