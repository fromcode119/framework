import { ThemeMode } from '@fromcode119/core/client';
import type { IWidgetStyle } from '@core/widget/interfaces/widget-style.interface';

export interface IWidgetSettingsRenderInput <TData extends Record<string, unknown> = Record<string, unknown>> {
  data: TData;
  layout: string;
  style?: IWidgetStyle;
  theme: ThemeMode;
  updateData: (key: string, val: unknown) => void;
  updateDataObject?: (data: TData) => void;
  updateLayout: (layout: string) => void;
  updateStyle?: (style: IWidgetStyle) => void;
}
