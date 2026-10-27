import type { IPersonFieldOption } from '@core/plugin/services/people/fields/interfaces/person-field-option.interface';

/** A person field as the operator declared it. Words are per language: `{ en: 'Favourite colour', bg: 'Любим цвят' }`. */
export interface IPersonField {
  key: string;
  label: Record<string, string>;
  /** A `PersonFieldType` value. */
  type: string;
  options: IPersonFieldOption[];
  /** Who reads this field and why — shown beside it in the admin. */
  description: Record<string, string>;
  /** The person may set it themselves (an app, the account page). */
  selfEditable: boolean;
  sortOrder: number;
}
