import type { CodeLanguage } from '@fromcode119/core/client';
import { FieldPosition } from '@fromcode119/core/client';

export interface ICollectionField {
  name: string;
  label?: string;
  type: string;
  localized?: boolean;
  required?: boolean;
  defaultValue?: any;
  /** Shown in an empty text box instead of the generic "Enter <label>..." — e.g. what an empty value sends. */
  placeholder?: string;
  options?: { label: string; value: any }[];
  relationTo?: string | string[];
  hasMany?: boolean;
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
    sourceCollection?: string;
    sourceField?: string;
    autofill?: Record<string, string | readonly string[]>;
    language?: CodeLanguage;
    [key: string]: any;
  };
}
