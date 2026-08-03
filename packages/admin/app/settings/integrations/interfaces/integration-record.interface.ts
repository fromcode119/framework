
import type { IIntegrationProvider } from '@/app/settings/integrations/interfaces/integration-provider.interface';
import type { IStoredProvider } from '@/app/settings/integrations/interfaces/stored-provider.interface';

export interface IIntegrationRecord {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  providers: IIntegrationProvider[];
  active?: { provider: string; source: string; config: Record<string, any> } | null;
  stored?: { providerKey: string; config: Record<string, any> } | null;
  storedProviders?: IStoredProvider[] | null;
}
