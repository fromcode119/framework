import { SettingSource } from '@core/settings/enums/setting-source.enum';

import type { IIntegrationProviderDefinition } from '@core/integrations/interfaces/integration-provider-definition.interface';

export interface IIntegrationResolved <TInstance = any> {
  type: string;
  providerKey: string;
  provider: IIntegrationProviderDefinition<TInstance>;
  config: Record<string, any>;
  source: SettingSource;
  /** The operator's display name for a stored provider entry (Settings → Integrations), when it has one. */
  name?: string;
}
