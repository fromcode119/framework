
import type { Logger } from '@core/logging';
import type { IIntegrationConfigField } from '@core/integrations/interfaces/integration-config-field.interface';

export interface IIntegrationProviderDefinition <TInstance = any> {
  key: string;
  label: string;
  description?: string;
  fields?: IIntegrationConfigField[];
  create: (config: Record<string, any>, context?: { projectRoot?: string; logger?: Logger }) => TInstance | Promise<TInstance>;
  normalizeConfig?: (config: Record<string, any>) => Record<string, any>;
  /**
   * The namespace of the plugin that registered this provider — stamped by the framework at
   * registration, never taken from a request. Stored on every saved provider entry so a consumer
   * (logistics resolving its courier plugin) knows where the provider's plugin lives.
   */
  namespace?: string;
}
