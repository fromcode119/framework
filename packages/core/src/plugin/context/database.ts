import { PhysicalTableNameUtils } from '@fromcode119/database/physical-table-name-utils';
import { NamingStrategy } from '@fromcode119/database';
import { sql, eq, and, or } from 'drizzle-orm';
import { LoadedPlugin } from '../../types';
import type { PluginManagerInterface } from './utils.interfaces';
import { ContextSecurityProxy } from './utils';
import { RateLimiter } from '../../security/rate-limiter';
import { SystemConstants } from '../../constants';

const dbLimiter = new RateLimiter(5000, 60000);

// Plugins read with the schema's camelCase field names. Raw-SQL paths in
// the dialects return rows keyed by snake_case DB columns; convert top-level
// keys here so plugin code can stick to one canonical name.
const ROW_RETURNING_METHODS = new Set(['find', 'findOne', 'insert', 'update']);

// Methods whose FIRST argument is a table name — guarded against system/other-plugin table access.
const TABLE_ARG_METHODS = new Set(['find', 'findOne', 'insert', 'update', 'delete', 'count']);
// Framework-owned system tables. Plugins must reach these ONLY through the dedicated context APIs
// (context.users / context.people / context.meta / context.media / context.recordVersions / …),
// which use the RAW manager db and so bypass this guard. Direct context.db access is a security
// violation (cross-plugin PII reads, tampering with auth/sessions/plugins, etc.).
const SYSTEM_TABLES = new Set<string>(Object.values(SystemConstants.TABLE).map((t) => String(t).toLowerCase()));

export class DatabaseContextProxy {
  private static denormalizeResult(result: any): any { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (result == null) return result;
    if (Array.isArray(result)) return result.map((row) => NamingStrategy.denormalizeRecord(row));
    return NamingStrategy.denormalizeRecord(result);
  }

  /**
   * Is `table` a framework system table OR another plugin's physical table? Plugins may only touch
   * their OWN tables via context.db; everything else is denied (use the dedicated context APIs).
   * `ownPrefix` is this plugin's physical prefix (`fcp_<slug>_`). The arg may be a physical name, a
   * collection slug (`@slug/x`, `slug-x`) or a shortSlug — only physical/system names are flagged here.
   */
  private static isForbiddenTable(table: unknown, ownPrefix: string): boolean {
    const name = String(table ?? '').trim().toLowerCase();
    if (!name) return false;
    if (name.startsWith('_system_')) return true;
    if (SYSTEM_TABLES.has(name)) return true;
    // Another plugin's physical table (fcp_<otherslug>_…). A plugin's own prefix is allowed.
    if (PhysicalTableNameUtils.hasPlatformPrefix(name) && !name.startsWith(ownPrefix.toLowerCase())) return true;
    return false;
  }

  static createDatabaseProxy(
  plugin: LoadedPlugin,
  manager: PluginManagerInterface,
  security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
) {
      const { hasCapability, handleViolation, handleRateLimit } = security;
      const tablePrefix = PhysicalTableNameUtils.createPluginPrefix(plugin.manifest.slug);

      const wrappedSql = new Proxy(sql, {
        get: (target, prop) => {
          if (prop === 'identifier') {
            return (name: string) => sql.identifier(`${tablePrefix}${name}`);
          }
          return (target as any)[prop];
        },
        apply: (target, thisArg, argumentsList) => {
          return (target as any).apply(thisArg, argumentsList);
        }
      });

      return new Proxy(manager.db, {
        get: (target, prop) => {
          if (!hasCapability('database') && !hasCapability('database:read') && !hasCapability('database:write')) {
            handleViolation('database');
          }

          const dbMethods = ['find', 'findOne', 'create', 'update', 'delete', 'execute', 'count'];
          if (typeof prop === 'string' && dbMethods.includes(prop)) {
            if (!dbLimiter.check(plugin.manifest.slug)) {
              handleRateLimit('database');
            }

            if (['create', 'update', 'delete', 'execute'].includes(prop)) {
                manager.audit.logAction(plugin.manifest.slug, 'Database Write', prop, 'allowed');
            }
          }

          if (prop === 'sql') return wrappedSql;
          if (prop === 'eq') return eq;
          if (prop === 'and') return and;
          if (prop === 'or') return or;

          if (typeof prop === 'string' && TABLE_ARG_METHODS.has(prop)) {
            const fn = (target as any)[prop];
            if (typeof fn !== 'function') return fn;
            const shouldDenormalize = ROW_RETURNING_METHODS.has(prop);
            return function (this: any, ...args: any[]) {
              // SECURITY: deny direct access to framework system tables and other plugins' tables.
              // The framework's own context proxies (users/people/meta/media/recordVersions/…) use the
              // RAW manager db, so they are NOT affected by this guard — only plugin context.db is.
              if (DatabaseContextProxy.isForbiddenTable(args[0], tablePrefix)) {
                manager.audit.logAction(plugin.manifest.slug, 'Database Access Denied', String(args[0]), 'blocked');
                throw new Error(
                  `Security Violation: plugin "${plugin.manifest.slug}" attempted direct context.db.${prop} on the protected table "${String(args[0])}". `
                  + 'Plugins may only access their OWN tables via context.db; use the dedicated context API '
                  + '(context.users / context.people / context.meta / context.media / context.recordVersions / …) for framework data.',
                );
              }
              const out = fn.apply(this, args);
              if (shouldDenormalize) {
                if (out && typeof out.then === 'function') {
                  return out.then(DatabaseContextProxy.denormalizeResult);
                }
                return DatabaseContextProxy.denormalizeResult(out);
              }
              return out;
            };
          }

          return (target as any)[prop];
        }
      });

  }
}
