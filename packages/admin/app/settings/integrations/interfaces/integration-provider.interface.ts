
import type { IIntegrationConfigField } from '@/app/settings/integrations/interfaces/integration-config-field.interface';

export interface IIntegrationProvider {
  key: string;
  label: string;
  description?: string;
  fields?: IIntegrationConfigField[];
}
