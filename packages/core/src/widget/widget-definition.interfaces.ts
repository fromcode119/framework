export interface WidgetStyle {
  animation?: string;
  backdropBlur?: string;
  background?: string;
  borderRadius?: string;
  boxShadow?: string;
  customClass?: string;
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  padding?: { top?: string; right?: string; bottom?: string; left?: string };
  textColor?: string;
  visibility?: 'all' | 'desktop' | 'mobile';
}

export interface WidgetSettingsRenderInput<TData extends Record<string, unknown> = Record<string, unknown>> {
  data: TData;
  layout: string;
  style?: WidgetStyle;
  theme: string;
  updateData: (key: string, val: unknown) => void;
  updateDataObject?: (data: TData) => void;
  updateLayout: (layout: string) => void;
  updateStyle?: (style: WidgetStyle) => void;
}

export interface WidgetDefinitionInput<TData extends Record<string, unknown> = Record<string, unknown>> {
  description?: string;
  icon?: unknown;
  id: string;
  layouts: string[];
  name: string;
  renderSettings: (props: WidgetSettingsRenderInput<TData>) => unknown;
}

export interface RegisteredWidgetDefinition<TData extends Record<string, unknown> = Record<string, unknown>>
  extends WidgetDefinitionInput<TData> {
  canonicalKey: string;
}
