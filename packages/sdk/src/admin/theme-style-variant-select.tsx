"use client";

import React from 'react';
import { PluginContextRegistry } from '@fromcode119/react';

interface ThemeStyleVariantSelectProps {
  value: string;
  onChange: (v: string) => void;
  includeAuto?: boolean;
}

/**
 * Theme style-variant <select>. Hook-free class: reads `themeStyleVariants` from the plugin
 * context via `static contextType` instead of the usePlugins hook.
 */
export class ThemeStyleVariantSelect extends React.Component<ThemeStyleVariantSelectProps> {
  static contextType = PluginContextRegistry.Context;
  declare context: React.ContextType<typeof PluginContextRegistry.Context>;

  render(): React.ReactNode {
    const { value, onChange, includeAuto = true } = this.props;
    const themeStyleVariants = ((this.context as any)?.themeStyleVariants as Record<string, any>) ?? {};
    const options = [
      ...(includeAuto ? [{ value: 'auto', label: 'Auto' }] : []),
      ...Object.entries(themeStyleVariants).map(([key, v]) => ({ value: key, label: (v as any).label ?? key })),
    ];
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }
}
