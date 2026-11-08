import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/react-class-components';
import { ThemeCssVariable } from '@fromcode119/core/client';
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
      root.style.setProperty(ThemeCssVariable.propertyFor(key), value);
    });
  }
}
