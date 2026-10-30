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
  /**
   * File types the provider takes this value as (`.json`, `.pem`, `.p8`, `.p12`, `.pfx`, `.cer`…): the admin
   * offers "Choose file", reads it in the browser and fills the field. The file itself is never uploaded or
   * stored — only the value, encrypted like any secret.
   */
  acceptFile?: string[];
  /**
   * The file is binary (a `.p12`/`.pfx` keystore, a DER certificate): the field gets its bytes as base64 and
   * the provider decodes them. Absent means the file is text (JSON, PEM) and the field gets that text.
   */
  fileAsBase64?: boolean;
}
