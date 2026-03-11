"use client";

import React from 'react';
import { PluginsProvider } from './context';
import type { PluginContextValue } from './context.interfaces';
import type { ThemeManagerProps } from './theme-manager.interfaces';

export class ThemeManager extends React.Component<ThemeManagerProps> {
  static contextType = PluginsProvider.PluginContext;

  declare context: PluginContextValue | null;

  componentDidMount(): void {
    this.applyThemeVariables();
  }

  componentDidUpdate(): void {
    this.applyThemeVariables();
  }

  render(): React.ReactNode {
    return null;
  }

  private applyThemeVariables(): void {
    const root = document.documentElement;
    const themeVariables = this.context?.themeVariables || {};
    Object.entries(themeVariables).forEach(([key, value]) => {
      root.style.setProperty(`--theme-${key}`, value);
    });
  }
}
