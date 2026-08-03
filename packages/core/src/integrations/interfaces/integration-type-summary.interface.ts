import type { IIntegrationConfigField } from '@core/integrations/interfaces/integration-config-field.interface';

export interface IIntegrationTypeSummary {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  providers: Array<{
    key: string;
    label: string;
    description?: string;
    fields?: IIntegrationConfigField[];
  }>;
}
