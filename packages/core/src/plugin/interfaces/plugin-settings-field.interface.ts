import { IField } from '@core/interfaces/field.interface';

export interface IPluginSettingsField extends IField {
  tab?: string;
  fields?: IPluginSettingsField[];
  /**
   * When `true`, this field's resolved value is exposed to the public, unauthenticated
   * storefront via `/api/v1/system/frontend` (and thus `runtime.globalSettings`).
   * Default is `false` (deny) — only explicitly opted-in, non-sensitive fields are published.
   * Password-typed and credential-named fields are NEVER published even if flagged.
   */
  public?: boolean;
}
