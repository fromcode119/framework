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
  /** File types the field can be filled from; read in the browser, never uploaded. */
  acceptFile?: string[];
  /** The file is binary: the field gets its bytes as base64, which the provider decodes. */
  fileAsBase64?: boolean;
}
