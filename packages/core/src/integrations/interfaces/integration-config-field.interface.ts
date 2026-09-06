import type { IntegrationConfigFieldType } from '@core/integrations/enums/integration-config-field-type.enum';

export interface IIntegrationConfigField {
  name: string;
  label: string;
  type: IntegrationConfigFieldType;
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  optionsEndpoint?: string;
  searchable?: boolean;
  defaultValue?: string | number | boolean;
  /**
   * The value may be sent to a browser (a publishable key, a display name, bank details a customer must
   * see). Absent means private: the owner never exposes it past the server. Generic — what "public"
   * means for a payment or shipping provider is that owner's business, this flag only marks the field.
   */
  public?: boolean;
}
