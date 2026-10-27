import type { IPersonFieldOption } from '@core/plugin/services/people/fields/interfaces/person-field-option.interface';

export interface IPersonFieldInput {
  key: string;
  label?: Record<string, string>;
  type: string;
  options?: IPersonFieldOption[];
  description?: Record<string, string>;
  selfEditable?: boolean;
  sortOrder?: number;
}
