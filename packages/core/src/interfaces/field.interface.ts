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
  /**
   * The plugin that added this field to another plugin's collection (`context.collections.extend`), set
   * by the framework. Its label and description are that plugin's to translate (`admin.extendedFields`),
   * since the owner of the collection has no words for a field it never declared. `'system'` marks a
   * field the framework adds itself (archive fields), whose words are the console's.
   */
  extendedBy?: string;
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
  /**
   * Readable only by someone who reads the whole collection — an administrator, or a role granted
   * reading it. The framework's generic reads (lists, single records, page resolution) never return it
   * to anyone else, and refuse to filter, sort or search by it, so it cannot be guessed a prefix at a
   * time. For a value the public side of a collection must never carry: a stored access password, a
   * cost price, the address of a paid file. The owning plugin still reads it through its own routes.
   */
  staffOnly?: boolean;
  /**
   * Held back from a reader who does not read the whole collection while ANY of these sibling fields
   * holds a value on the record: content behind a password or a plan. The generic reads return it as
   * `null` and list it in the record's `withheldFields`, so a storefront can say why rather than show
   * an empty page; the owning plugin serves it to the reader entitled to it. Page resolution leaves it
   * to the plugin's content-resolution gate, which knows the visitor.
   */
  withheldWhen?: string[];
  /**
   * Derived data kept for one consumer — a prepared document a read route answers with, its sort and
   * filter keys. Not part of a read that does not name it: the public side of the generic reads and a
   * plugin's own `find` / `findOne` without `columns` leave it out, so every other read of the record
   * does not carry it. Staff reading the whole collection still see it in the console.
   */
  readOnRequest?: boolean;
  min?: number; // For number
  max?: number; // For number
  minLength?: number; // For text
  maxLength?: number; // For text
  language?: CodeLanguage | string; // For code; declared as a literal, compare with `CodeLanguage.resolve()`
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
    /** A `select` that holds several of its options (stored as an array) — rendered as a multi-select. */
    multiple?: boolean;
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
      /** Declared as a literal by collections (`'equals'`); compare with `ConditionOperator.resolve()`, never `===`. */
      operator: ConditionOperator | string;
      value?: any;
    };
    tab?: string;
    section?: string;
  };
}
