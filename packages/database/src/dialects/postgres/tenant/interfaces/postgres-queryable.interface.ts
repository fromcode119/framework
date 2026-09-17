/** The only thing this needs of a `pg` client, so tests can pass a recorder. */
export interface IPostgresQueryable {
  query(text: string, values?: unknown[]): Promise<unknown>;
}
