import type { SortDirection } from '@database/enums/sort-direction.enum';

/** A measure's `as`, a `groupBy` field, or `bucket`, and its direction (default `DESC`). */
export interface IAggregateOrder {
  by: string;
  direction?: SortDirection;
}
