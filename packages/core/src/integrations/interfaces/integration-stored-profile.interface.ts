import type { IIntegrationStoredProvider } from '@core/integrations/interfaces/integration-stored-provider.interface';

export interface IIntegrationStoredProfile {
  id: string;
  name: string;
  providerKey: string;
  config: Record<string, any>;
  activeProviderKey?: string;
  providers?: IIntegrationStoredProvider[];
  createdAt?: string;
  updatedAt?: string;
}
