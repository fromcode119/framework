import type { Collection, Field } from './schema.interfaces';

export interface EntityInputAlias {
  field: string;
  from: string[];
}

export interface EntityIndex {
  name?: string;
  fields: string[];
  unique?: boolean;
}

export interface EntityDerivedField {
  name: string;
  dependsOn?: string[];
  readOnly?: boolean;
}

export interface EntityApiOptions {
  create?: boolean;
  read?: boolean;
  update?: boolean;
  delete?: boolean;
}

export interface EntityAdminLayout {
  sections?: Array<{ name: string; label: string; description?: string }>;
  tabs?: Array<{ name: string; label: string; icon?: string }>;
}

export interface EntityDefinition extends Collection {
  indexes?: EntityIndex[];
  inputAliases?: EntityInputAlias[];
  derivedFields?: EntityDerivedField[];
  api?: EntityApiOptions;
  adminLayout?: EntityAdminLayout;
}

export interface EntityFieldValidationError {
  field: string;
  message: string;
}

export interface EntityParseOptions {
  mode?: 'create' | 'update';
  includeUnknown?: boolean;
  skipReadOnly?: boolean;
  /**
   * System fields (`createdAt`/`updatedAt`) that are normally skipped but should be allowed
   * through because the caller has already authorized a read-only override for them
   * (e.g. an admin unlocked "Created Date" and passed password confirmation). `id` is never allowed.
   */
  allowSystemFields?: string[];
}

export interface EntityParseResult {
  data: Record<string, unknown>;
  errors: EntityFieldValidationError[];
}

export interface EntityField extends Field {
  inputAliases?: string[];
}
