import type { IEntityFieldValidationError } from '@fromcode119/core';

/** Plugin settings refused on save: the English sentence per field, and the same refusals by code. */
export interface IPluginSettingsRefusal {
  errors: Record<string, string>;
  refusals: IEntityFieldValidationError[];
}
