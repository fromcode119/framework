import type { IIntegrationProviderDefinition } from '@ai/gateways/interfaces/integration-provider-definition.interface';

/** A category of integration (e.g. a model gateway) and the providers that can serve it. */
export interface IIntegrationTypeDefinition<TInstance = any> {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  providers?: IIntegrationProviderDefinition<TInstance>[];
  resolveFromEnv?(): { provider?: string; config?: Record<string, any> } | null;
}
