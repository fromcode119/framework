import { IntegrationFieldType } from '@/app/settings/integrations/enums/integration-field-type.enum';

export interface IIntegrationConfigField {
  name: string;
  label: string;
  type: IntegrationFieldType;
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  optionsEndpoint?: string;
  searchable?: boolean;
  defaultValue?: string | number | boolean;
}
