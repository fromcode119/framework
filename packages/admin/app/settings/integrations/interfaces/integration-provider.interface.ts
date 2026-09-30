
import type { IIntegrationConfigField } from '@/app/settings/integrations/interfaces/integration-config-field.interface';
import type { IIntegrationSetupAddress } from '@/app/settings/integrations/interfaces/integration-setup-address.interface';

export interface IIntegrationProvider {
  key: string;
  label: string;
  description?: string;
  fields?: IIntegrationConfigField[];
  setupAddresses?: IIntegrationSetupAddress[];
}
