import type { IEntityFieldValidationError } from '@core/entity/interfaces/entity-field-validation-error.interface';

export interface IEntityParseResult {
  data: Record<string, unknown>;
  errors: IEntityFieldValidationError[];
}
