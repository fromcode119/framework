import { ICollection, SystemConstants } from '@fromcode119/core';
import { sql } from '@fromcode119/database';
import { TenantUserScope } from '@api/services/request/tenant-user-scope';

/**
 * The `users` table is also reachable through the generic collection REST API (`/collections/users`,
 * GraphQL, the runtime data-source endpoint), and none of those doors applied `TenantUserScope` — the
 * narrowing every dedicated user screen already carries. The only gate left was the collection access
 * policy's `roles.includes('admin')`, and inside a site that role comes from the site's MEMBERSHIP. So a
 * site's own administrator listed every account on the platform, read any account by id, and wrote any
 * account — email, roles, permissions, password — belonging to a different site. Measured locally: an
 * admin of one site, not a platform admin, listed 32 accounts where the site has 2 members, and
 * rewrote a customer of another site.
 *
 * The rule is the same one `TenantUserScope` states: with a site selected, a site's users are its
 * members, platform admin included; platform-wide account administration happens in PLATFORM scope,
 * and only for a platform admin.
 *
 * Like `SystemMetaCollectionGuard`, it keys off the TABLE, so re-registering the collection under
 * another slug cannot step around it, and the list restriction is a WHERE fragment so `docs`,
 * `totalDocs`, pagination and export all agree.
 */
export class UserCollectionScopeGuard {
  /** True when this collection reads the framework's identity table and must be narrowed. */
  static guards(collection: ICollection): boolean {
    return collection?.tableName === SystemConstants.TABLE.USERS;
  }

  /** The request's account scope, or `null` for any other collection. */
  static async scopeFor(collection: ICollection, req: unknown, db: unknown): Promise<TenantUserScope | null> {
    if (!UserCollectionScopeGuard.guards(collection)) return null;
    return TenantUserScope.of(req, db);
  }

  /** The clause every list read must carry, or `null` when the scope is unrestricted. */
  static buildReadClause(scope: TenantUserScope | null): any {
    const ids = scope?.ids ?? null;
    if (!ids) return null;
    // An empty scope is "no accounts", never "no filter".
    if (!ids.length) return sql`1 = 0`;
    return sql`${sql.identifier('id')} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`;
  }

  /** The object form of the same restriction, for readers that take a plain `where`. */
  static buildWhere(scope: TenantUserScope | null): Record<string, unknown> | null {
    const ids = scope?.ids ?? null;
    return ids ? { id: { in: ids } } : null;
  }

  /** Whether a single account may be read or written in this scope. */
  static allows(scope: TenantUserScope | null, id: unknown): boolean {
    if (!scope) return true;
    const numeric = Number(id);
    return Number.isInteger(numeric) && scope.allows(numeric);
  }

  /**
   * NOT FOUND, rather than refused, for an account outside the scope — a 403 would confirm that the
   * id exists somewhere on the platform.
   */
  static ensureAllows(scope: TenantUserScope | null, id: unknown): void {
    if (UserCollectionScopeGuard.allows(scope, id)) return;
    const error = new Error('Not found') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  /**
   * An account created here would land in the global table belonging to no site — invisible to the
   * site that made it, and outside every scope but the platform's. Creating a site's account is done
   * on its Users screen, which also grants the membership; a platform-wide account, in platform scope.
   */
  static ensureCreateAllowed(scope: TenantUserScope | null): void {
    if (!scope || scope.ids === null) return;
    const error = new Error(
      'Only a platform admin, in platform scope, can create accounts through the collection API. '
      + 'A site\'s accounts are created on its Users screen.',
    ) as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
}
