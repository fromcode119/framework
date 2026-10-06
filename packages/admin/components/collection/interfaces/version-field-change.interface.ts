/** One field that differs between two versions of a record, ready to print. */
export interface IVersionFieldChange {
  /** The field's label in the admin (its name when the collection does not declare it). */
  label: string;
  from: string;
  to: string;
}
