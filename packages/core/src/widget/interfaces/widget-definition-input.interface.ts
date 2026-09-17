import type { ComponentType } from 'react';
import type { IWidgetSettingsRenderInput } from '@core/widget/interfaces/widget-settings-render-input.interface';

export interface IWidgetDefinitionInput <TData extends Record<string, unknown> = Record<string, unknown>> {
  description?: string;
  icon?: unknown;
  id: string;
  layouts: string[];
  name: string;
  /**
   * The settings editor for this widget — a COMPONENT, mounted by the block editor as
   * `<SettingsComponent {...input} />`, not a function it calls itself.
   *
   * It was typed `(props) => unknown`, which describes only a function component. Every consumer
   * already casts it back (`def.renderSettings as React.ComponentType<any>`), and a class component —
   * which is what a reactor settings panel is — needs `new`, so three plugins that pass one were
   * rejected by a signature no caller actually used. The honest type is the one the editor mounts.
   */
  renderSettings: ComponentType<IWidgetSettingsRenderInput<TData>>;
}
