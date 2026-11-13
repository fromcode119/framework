/** What a {@link DebouncedSearchController} tells its owner. */
export interface IDebouncedSearchCallbacks<T> {
  /** The answer to the NEWEST read, with the term it answers, so the owner can label its own note. */
  onResult: (rows: T, term: string) => void;
  /** A read is in flight: an empty list meanwhile is not an empty collection. */
  onSearching?: (searching: boolean) => void;
  /** The read failed. Without this the owner simply keeps the list it had. */
  onError?: (error: Error, term: string) => void;
}
