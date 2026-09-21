import type { IJsonFieldReference } from '@core/interfaces/json-field-reference.interface';
import { ConditionOperator } from '@core/enums/condition-operator.enum';
import { CodeLanguage } from '@core/enums/code-language.enum';
import { FieldWidth } from '@core/enums/field-width.enum';
import { FieldPosition } from '@core/enums/field-position.enum';
import { FieldType } from '@core/enums/field-type.enum';

export interface IField {
  name: string;
  /**
   * Field kind. Collections declare this as a raw literal (`type: 'text'`) in their static field data;
   * the framework normalizes with `FieldType.resolve()`. Compare via `resolve()`, never with `===`
   * against an Enum member, or the check silently never matches.
   */
  type: FieldType | string;
  label?: string;
  placeholder?: string;
  localized?: boolean;
  required?: boolean;
  unique?: boolean;
  defaultValue?: any;
  options?: { label: string; value: any }[]; // For select type
  relationTo?: string | string[]; // For relationship/upload type
  /**
   * A relationship to whichever collection REGISTERED itself as this entity's provider, instead of a
   * hardcoded `relationTo: '<other-plugin>-<collection>'`. The framework substitutes the provider's
   * slug into `relationTo`, so the searchable control, the list display and every join are unchanged.
   */
  relationToEntity?: string;
  hasMany?: boolean; // For relationship
  min?: number; // For number
  max?: number; // For number
  minLength?: number; // For text
  maxLength?: number; // For text
  language?: CodeLanguage; // For code
  showTime?: boolean; // For date/datetime
  fields?: IField[]; // For array/group fields
  inputAliases?: string[];

  /**
   * Where ids live inside THIS field's JSON document — see {@link IJsonFieldReference}.
   *
   * Only for a `json` field. A `relationship` field already declares its target, and an
   * `array`/`group` field's sub-fields declare theirs; this is for the documents that declare
   * nothing and would otherwise carry a source deployment's ids across an import unchanged.
   */
  jsonReferences?: IJsonFieldReference[];
  admin?: {
    hidden?: boolean;
    readOnly?: boolean;
    description?: string;
    /** Declared as a literal by collections; compare with `FieldPosition.resolve()`, never `===`. */
    position?: FieldPosition | string;
    component?: string;
    sourceCollection?: string;
    sourceField?: string;
    /**
     * For `relationship` fields: when a record is picked, copy values from the selected
     * related record into sibling fields on this form (live, before save).
     * Keys are the LOCAL sibling field names to fill; values are the source field on the
     * related record — a single field name, or a list of fields joined with a space
     * (e.g. `{ email: 'email', name: ['firstName', 'lastName'] }`).
     */
    autofill?: Record<string, string | readonly string[]>;
    handlesLocalization?: boolean;
    /** Declared as a literal by collections; compare with `FieldWidth.resolve()`, never `===`. */
    width?: FieldWidth | string;
    condition?: {
      field: string;
      operator: ConditionOperator;
      value?: any;
    };
    tab?: string;
    section?: string;
  };
}
