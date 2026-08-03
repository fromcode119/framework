import type React from 'react';

/**
 * One column of a {@link DataTable}: its heading, how to read the cell out of a row, and its display
 * options.
 *
 * A CLASS, not an interface — it is a data record, and the conventions put records on classes. It stays
 * generic over the ROW type so `accessor` is checked against the row's real keys: `keyof T` catches a
 * typo'd column at compile time, which is the whole reason the parameter is here. Callers keep passing
 * plain object literals; a class with no methods and no private members is structurally identical to
 * the interface it replaces.
 */
export class Column<T> {
  declare header: string;
  declare accessor: keyof T | ((row: T) => React.ReactNode);
  declare id: string;
  declare sortable?: boolean;
  declare className?: string;
}
