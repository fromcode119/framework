
import type { IIntegrationProvider } from '@/app/settings/integrations/interfaces/integration-provider.interface';
import type { IStoredProvider } from '@/app/settings/integrations/interfaces/stored-provider.interface';

export interface IIntegrationRecord {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  /** False: one provider at a time, and saving one replaces the active one. */
  allowMultipleActiveProviders: boolean;
  /** Who registered the type: a plugin's slug and name, or empty strings for the framework. */
  owner: { slug: string; label: string };
  providers: IIntegrationProvider[];
  active?: { provider: string; source: string; config: Record<string, any> } | null;
  stored?: { providerKey: string; config: Record<string, any> } | null;
  storedProviders?: IStoredProvider[] | null;
}
