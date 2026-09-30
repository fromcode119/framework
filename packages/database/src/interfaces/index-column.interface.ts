import type { SortDirection } from '@database/enums/sort-direction.enum';

/** One column of an index, with an explicit sort order. A plain column name is the unordered form. */
export interface IIndexColumn {
  name: string;
  order?: SortDirection;
}
