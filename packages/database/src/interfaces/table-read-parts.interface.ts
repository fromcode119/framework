/** The parts of a whole-table read: a filter fragment, order expressions, and paging. */
export interface ITableReadParts {
  where?: any;
  orderBy?: any[];
  limit?: number;
  offset?: number;
}
