import type { IIntegrationProviderDefinition } from '@core/integrations/interfaces/integration-provider-definition.interface';
import type { IIntegrationTypeDefinition } from '@core/integrations/interfaces/integration-type-definition.interface';

export interface IIntegrationTypeRuntime <TInstance = any> {
  definition: IIntegrationTypeDefinition<TInstance>;
  providers: Map<string, IIntegrationProviderDefinition<TInstance>>;
}
