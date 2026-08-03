import { WidgetViewport } from '@core/widget/enums/widget-viewport.enum';

export interface IWidgetStyle {
  animation?: string;
  backdropBlur?: string;
  background?: string;
  borderRadius?: string;
  boxShadow?: string;
  customClass?: string;
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  padding?: { top?: string; right?: string; bottom?: string; left?: string };
  textColor?: string;
  visibility?: WidgetViewport;
}
