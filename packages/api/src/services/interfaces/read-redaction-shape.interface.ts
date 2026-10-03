/** What a collection's fields declare a partial reader may not see — worked out once per field list. */
export interface IReadRedactionShape {
  count: number;
  /** Fields declared `staffOnly`. */
  staffOnly: string[];
  /** Each `withheldWhen` field, with the sibling fields that hold it back. */
  withheld: Array<{ field: string; when: string[] }>;
}
