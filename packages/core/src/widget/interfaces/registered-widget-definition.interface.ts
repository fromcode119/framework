import { IWidgetDefinitionInput } from '@core/widget/interfaces/widget-definition-input.interface';

export interface IRegisteredWidgetDefinition <TData extends Record<string, unknown> = Record<string, unknown>>
  extends IWidgetDefinitionInput<TData> {
  canonicalKey: string;
}
