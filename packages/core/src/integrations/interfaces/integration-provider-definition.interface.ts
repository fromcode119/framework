
import type { Logger } from '@core/logging';
import type { IIntegrationConfigField } from '@core/integrations/interfaces/integration-config-field.interface';

export interface IIntegrationProviderDefinition <TInstance = any> {
  key: string;
  label: string;
  description?: string;
  fields?: IIntegrationConfigField[];
  create: (config: Record<string, any>, context?: { projectRoot?: string; logger?: Logger }) => TInstance | Promise<TInstance>;
  normalizeConfig?: (config: Record<string, any>) => Record<string, any>;
}
