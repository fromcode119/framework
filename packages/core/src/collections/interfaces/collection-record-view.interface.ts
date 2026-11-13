/**
 * What the header of a record page says besides the record's title.
 *
 * Every entry names a field the collection itself declares. Left out, the line under the title shows the
 * list's `meta` fields and the header shows the record's `status`.
 */
export interface ICollectionRecordView {
  /** Fields joined into the line under the title — when the record was made, where it came from. */
  readonly meta?: readonly string[];
  /** Select fields shown beside the title as badges, each in its selected option's `tone`. */
  readonly badges?: readonly string[];
}
