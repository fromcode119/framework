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
   * Columns an OLDER schema used for what this field now holds, as `archive column -> key in this
   * field`. An import folds them in rather than dropping them: a deployment that stored an address
   * as eight flat columns still carries the address, it just carries it in the shape of its day.
   *
   * The left side is the physical, snake_case column as the archive wrote it — the legacy name is
   * the only thing that can still find legacy data, so it is not normalised.
   */
  legacyColumns?: Record<string, string>;
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
