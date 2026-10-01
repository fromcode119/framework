import type { IIntegrationSetupAddress } from '@core/integrations/interfaces/integration-setup-address.interface';
import type { IIntegrationConfigField } from '@core/integrations/interfaces/integration-config-field.interface';

export interface IIntegrationTypeSummary {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  /** See `IIntegrationTypeDefinition.platformOnly`. */
  platformOnly: boolean;
  providers: Array<{
    key: string;
    label: string;
    description?: string;
    fields?: IIntegrationConfigField[];
    setupAddresses?: IIntegrationSetupAddress[];
  }>;
}
