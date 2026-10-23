import type { ICollectionQuickEdit } from '@core/collections/interfaces/collection-quick-edit.interface';

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
  /**
   * A single select, or a relationship to one record, that sorts the records into sections — one per
   * option or related record, in its order, under its name. Records with no value come last.
   */
  readonly groupBy?: string;
  /**
   * A number field holding the operator's own order. The list shows the records in it, all on one page,
   * and the operator drags them into place; the numbers are written by the list, never typed.
   */
  readonly order?: string;
  readonly quickEdit?: ICollectionQuickEdit;
}
