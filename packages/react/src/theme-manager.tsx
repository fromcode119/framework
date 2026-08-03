import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/reactor';
import { PluginsProvider } from '@react/context/view/plugins-provider.client';
import type { IPluginContextValue } from '@react/interfaces/plugin-context-value.interface';

export class ThemeManager extends Reactor {
  @prop declare apiUrl: string;

  static contextType = PluginsProvider.PluginContext;

  declare context: IPluginContextValue | null;

  componentDidMount(): void {
    this.applyThemeVariables();
  }

  componentDidUpdate(): void {
    this.applyThemeVariables();
  }

  render(): ReactNode {
    return null;
  }

  private applyThemeVariables(): void {
    const root = document.documentElement;
    const themeVariables = this.context?.themeVariables || {};
    Object.entries(themeVariables).forEach(([key, value]) => {
      const cssKey = key.startsWith('--') ? key : `--theme-${key}`;
      root.style.setProperty(cssKey, value);
    });
  }
}
