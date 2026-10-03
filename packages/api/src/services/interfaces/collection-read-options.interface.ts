/**
 * What the framework itself may add to a collection's ordinary read — never a visitor: it is passed
 * under a Symbol on the request (CollectionReadOptions.KEY), which no query string or body can set.
 */
export interface ICollectionReadOptions {
  /** Extra conditions, ANDed with every rule the read already applies. */
  where?: (db: any, table: any) => unknown;
  /** The order to read in, replacing the `?sort=` one. */
  orderBy?: (db: any, table: any) => unknown[];
  /**
   * Only these fields of each record, and `id`. Every rule of the read still applies — the access
   * rule and the published-only rule filter in the query, not on the fields read.
   */
  fields?: string[];
  /** The caller has no use for `totalDocs`, so the second query that counts the matches is not run. */
  withoutTotal?: boolean;
}
