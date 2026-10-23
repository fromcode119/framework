/**
 * One section of a {@link DataTable} drawn as a heading over its rows. A section may have no rows: its
 * heading still shows, with a count of 0, so a list can say a group exists and take records dropped on it.
 *
 * `id` marks the heading the same way a row's id marks the row (`data-row-id`), so a pointer drag that
 * looks for rows finds headings too.
 */
export class DataTableSection<T> {
  constructor(
    readonly id: string,
    readonly label: string,
    readonly rows: readonly T[],
  ) {}
}
