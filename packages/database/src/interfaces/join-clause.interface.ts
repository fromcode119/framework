import { JoinType } from '@database/enums/join-type.enum';

/**
 * Describes a JOIN clause for use with IDatabaseManager.find().
 * Works with string-based table names (e.g. SystemTable constants).
 *
 * @example
 * db.find(SystemTable.SESSIONS, {
 *   where: { isRevoked: false },
 *   joins: [{ table: SystemTable.USERS, on: { from: 'userId', to: 'id' }, columns: ['email'] }]
 * })
 * // Returns rows with "email" merged in at the top level.
 * // Use `as` to nest: as: 'user' → row.user.email
 */
export interface IJoinClause {
  /** Table to join against. */
  table: string;
  /** Join condition: main_table[from] = joined_table[to] */
  on: { from: string; to: string };
  /** Join type. Defaults to 'inner'. */
  type?: JoinType;
  /** If set, joined columns are nested under this key in the result. Otherwise merged flat. */
  as?: string;
  /** Which columns to select from the joined table. Required — no wildcard joins. */
  columns: string[];
}
