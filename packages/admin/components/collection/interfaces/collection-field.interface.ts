import type { CodeLanguage } from '@fromcode119/core/client';
import { FieldPosition } from '@fromcode119/core/client';

export interface ICollectionField {
  name: string;
  label?: string;
  /** Who added the field to this collection — a plugin slug, or `system` for the framework (see `IField.extendedBy`). */
  extendedBy?: string;
  type: string;
  localized?: boolean;
  required?: boolean;
  defaultValue?: any;
  /** Shown in an empty text box instead of the generic "Enter <label>..." — e.g. what an empty value sends. */
  placeholder?: string;
  options?: { label: string; value: any }[];
  relationTo?: string | string[];
  hasMany?: boolean;
  /**
   * The sub-fields of one ROW, for a field that holds a list of them.
   *
   * `array` has always meant this. A `json` field that declares them means the same thing and is drawn
   * the same way — which is what stops a plugin from writing a control per list. Each sub-field is an
   * ordinary field: text, number, select, boolean or relationship, with its own label and admin options.
   */
  fields?: ICollectionField[];
  admin?: {
    component?: string;
    handlesLocalization?: boolean;
    readOnly?: boolean;
    hidden?: boolean;
    /**
     * The name of the SIBLING field whose component renders this one's control.
     *
     * The standard renderer skips this field so the value is not drawn twice, but — unlike
     * `hidden` — the control still exists and this says where. Use it when several fields form one
     * thing an operator reads together (an order's amounts, a date range) and a single component
     * edits them through the reactive `record`/`onPatch` props.
     *
     * The named field must be on the same form and must declare `admin.component`; otherwise the
     * value has no control at all, which is the Rule Zero failure `hidden` causes.
     */
    renderedBy?: string;
    /** Read on the card by the named sibling's `readComponent`; still edited by its own control. */
    readBy?: string;
    /**
     * How often an operator needs this field: `everyday` (the default), `occasional` or `technical`.
     * The edit form opens on the everyday fields and says how many more there are; see `FieldLevel`.
     * Declared as a literal by collections; compare with `FieldLevel.resolve()`, never `===`.
     */
    level?: string;
    /**
     * The section this field sits in starts COLLAPSED on the edit form: its card shows the title, how
     * many fields it holds and a Show button, and one click opens it. For values an operator rarely
     * reads but must be able to see — what the runtime computed from the record. Not `hidden`: the
     * section and its fields are always one click away, and a section holding a field with an error
     * opens by itself. Any field of the section declaring it collapses the section.
     */
    sectionCollapsed?: boolean;
    /**
     * Suppress the field's own label row.
     *
     * For a control that prints its own heading — a summary that already names each line it holds —
     * where the renderer's label would be the same word twice, stacked. Read by the field header and
     * declared here because an option that only exists at its read site is one nobody can find.
     */
    hideLabel?: boolean;
    position?: FieldPosition;
    description?: string;
    /**
     * How a list of rows is laid out: `table` names the columns once in a header and gives each row one
     * line; left out, the rows stack as cards, which is what a reorderable list wants.
     */
    layout?: string;
    /**
     * The shape a text value must have for the runtime to use it, as a regular expression, with
     * `patternNote` the words shown under the box when it does not. It never blocks typing or saving —
     * it states what will happen, which is the whole reason a field can say this instead of a plugin
     * drawing its own control to print one warning. See `FieldPatternService`.
     */
    pattern?: string;
    patternNote?: string;
    sourceCollection?: string;
    sourceField?: string;
    autofill?: Record<string, string | readonly string[]>;
    language?: CodeLanguage;
    [key: string]: any;
  };
}
