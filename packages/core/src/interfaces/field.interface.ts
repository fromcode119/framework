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
    /**
     * The SIBLING field whose component renders this field's control.
     *
     * The admin's standard renderer skips a field that declares it, so several fields an operator
     * reads as one thing — an order's amounts, a date range — can be edited by a single component
     * through the reactive `record`/`onPatch` props.
     *
     * It is NOT `hidden`, and must not be used as a quiet substitute for it. Hidden asserts there is
     * no control, which Rule Zero forbids; this NAMES the control's owner, so "what edits this value?"
     * still has a written answer. The named field must be on the same form and declare
     * `admin.component`.
     */
    renderedBy?: string;
    /**
     * Suppress the field's own label row.
     *
     * For a control that prints its own heading — a summary that already names each line it holds —
     * where the renderer's label would be the same word twice, stacked. Read by the field header and
     * declared here because an option that only exists at its read site is one nobody can find.
     */
    hideLabel?: boolean;
    /**
     * For a `CountryField` that overrides the platform country (Settings → Localization): when the
     * value is blank the control names the country actually in effect and where it came from, so an
     * empty box never hides the value a module runs on.
     */
    inheritsPlatformCountry?: boolean;
    condition?: {
      field: string;
      operator: ConditionOperator;
      value?: any;
    };
    tab?: string;
    section?: string;
  };
}
