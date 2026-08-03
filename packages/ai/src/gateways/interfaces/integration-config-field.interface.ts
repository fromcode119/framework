import type { IntegrationConfigFieldType } from '@fromcode119/core/client';

/** One configurable field an integration provider asks for (rendered in the admin settings form). */
export interface IIntegrationConfigField {
  name: string;
  label: string;
  type: IntegrationConfigFieldType;
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
}
