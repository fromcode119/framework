/** One field of the quick edit form under a list row. */
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
