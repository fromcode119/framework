/** Words per language: `{ en: 'Favourite colour', bg: 'Любим цвят' }`. */
export type LocalizedWords = Record<string, string>;

export interface IPersonFieldOption {
  key: string;
  label: LocalizedWords;
}

/** A person field as the operator declared it. */
export interface IPersonField {
  key: string;
  label: LocalizedWords;
  /** A `PersonFieldType` value. */
  type: string;
  options: IPersonFieldOption[];
  /** Who reads this field and why — shown beside it in the admin. */
  description: LocalizedWords;
  /** The person may set it themselves (an app, the account page). */
  selfEditable: boolean;
  sortOrder: number;
}

export interface IPersonFieldInput {
  key: string;
  label?: LocalizedWords;
  type: string;
  options?: IPersonFieldOption[];
  description?: LocalizedWords;
  selfEditable?: boolean;
  sortOrder?: number;
}
