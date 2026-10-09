/**
 * How a collection's records read in the admin list, and which fields can be changed from it.
 *
 * Every entry names a field the collection itself declares; the list never invents a value. Left out,
 * the list falls back to what the collection already says: `useAsTitle` for the title, a `status`
 * select for the badge, and the first `defaultColumns` for the meta line.
 */
export interface ICollectionListView {
  /** A media relationship whose first item is the row's thumbnail. */
  readonly media?: string;
  /** A select shown as a pill on the row and the phone card. */
  readonly badge?: string;
  /** Fields joined into the phone card's second line. */
  readonly meta?: readonly string[];
  /** One value shown at the right of the phone card — a price, a total, a date. */
  readonly trailing?: string;
  readonly quickEdit?: ICollectionQuickEdit;
}

export interface ICollectionQuickEdit {
  /** Fields whose value is edited in place by clicking it in the list. */
  readonly inline?: readonly string[];
  /** Fields of the form that opens under a row, in order. */
  readonly row?: readonly ICollectionQuickEditField[];
}

export interface ICollectionQuickEditField {
  readonly field: string;
  /**
   * The control to edit it with: `text`, `textarea`, `number`, `select`, `multiselect`, `toggle`,
   * `date`, `relation` or `tags`. Omitted, the field's own type decides. A control has to suit the
   * field — `textarea` for a text field, `toggle` for a checkbox — and one that does not is refused.
   */
  readonly control?: string;
  /** Columns the field spans in the quick edit grid, 1–4. Phones always use the full width. */
  readonly span?: number;
}
