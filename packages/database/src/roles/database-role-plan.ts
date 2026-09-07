import { DatabaseRole } from '@database/roles/database-role';

/**
 * The logins a deployment needs, and the database they need reaching.
 *
 * `owner` is the role that runs DDL and owns the schema; `runtime` serves requests and must never be a
 * superuser or the schema owner, because both bypass row-level security. A deployment that runs
 * everything as one role passes the same role as both, which is correct for a single-tenant install.
 */
export class DatabaseRolePlan {
  constructor(
    readonly database: string,
    readonly owner: DatabaseRole,
    readonly runtime: DatabaseRole,
  ) {}

  /** True when one role does both jobs, so there is only one login to provision. */
  get isSingleRole(): boolean {
    return this.owner.name === this.runtime.name;
  }
}
