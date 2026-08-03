import type { IWidgetSettingsRenderInput } from '@core/widget/interfaces/widget-settings-render-input.interface';

export interface IWidgetDefinitionInput <TData extends Record<string, unknown> = Record<string, unknown>> {
  description?: string;
  icon?: unknown;
  id: string;
  layouts: string[];
  name: string;
  renderSettings: (props: IWidgetSettingsRenderInput<TData>) => unknown;
}
