
import type { IIntegrationProviderDefinition } from '@core/integrations/interfaces/integration-provider-definition.interface';

export interface IIntegrationTypeDefinition <TInstance = any> {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  allowMultipleActiveProviders?: boolean;
  providers?: IIntegrationProviderDefinition<TInstance>[];
  resolveFromEnv?: () => { provider?: string; config?: Record<string, any> } | null;
}
