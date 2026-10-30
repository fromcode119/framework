import type { IIntegrationSetupAddress } from '@core/integrations/interfaces/integration-setup-address.interface';
import type { IIntegrationConfigField } from '@core/integrations/interfaces/integration-config-field.interface';

export interface IIntegrationTypeSummary {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  /** See `IIntegrationTypeDefinition.platformOnly`. */
  platformOnly: boolean;
  /** See `IIntegrationTypeDefinition.allowMultipleActiveProviders`: false means choosing a provider replaces the active one. */
  allowMultipleActiveProviders: boolean;
  /** Who registered the type: a plugin's slug and name, or empty strings for the framework. */
  owner: { slug: string; label: string };
  providers: Array<{
    key: string;
    label: string;
    description?: string;
    fields?: IIntegrationConfigField[];
    setupAddresses?: IIntegrationSetupAddress[];
  }>;
}
