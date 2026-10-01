
import type { IIntegrationProviderDefinition } from '@core/integrations/interfaces/integration-provider-definition.interface';

export interface IIntegrationTypeDefinition <TInstance = any> {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  allowMultipleActiveProviders?: boolean;
  /**
   * Configured once for the whole platform, by the platform admin — never per site. A site cannot list or
   * change it: a site-level entry would be one nothing reads (the platform monitor reads the platform's).
   */
  platformOnly?: boolean;
  providers?: IIntegrationProviderDefinition<TInstance>[];
  resolveFromEnv?: () => { provider?: string; config?: Record<string, any> } | null;
}
