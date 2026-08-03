import type { IEntityFieldValidationError } from '@core/interfaces/entity-field-validation-error.interface';

export interface IEntityParseResult {
  data: Record<string, unknown>;
  errors: IEntityFieldValidationError[];
}
