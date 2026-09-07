import { PhysicalTableNameUtils } from '@fromcode119/database/physical-table-name-utils';
import { NamingStrategy } from '@fromcode119/database';
import { sql, eq, and, or } from 'drizzle-orm';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { ContextSecurityProxy } from '@core/plugin/context/utils';
import { DatabaseWriteAudit } from '@core/plugin/context/database-write-audit';
import { EnumValueCoercion } from '@core/plugin/context/enum-value-coercion';
import { LocalizedReadResolver } from '@core/plugin/context/localized-read-resolver';
import { RateLimiter } from '@core/security/rate-limiter';
import { SystemConstants } from '@core/constants/system.constants';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import { UntenantedBootAccess } from '@core/plugin/context/untenanted-boot-access';
import { TenantScopedTableDdl } from '@core/database/tenant-scoped-table-ddl';

// Plugins read with the schema's camelCase field names. Raw-SQL paths in
// the dialects return rows keyed by snake_case DB columns; convert top-level
// keys here so plugin code can stick to one canonical name.

// Methods whose FIRST argument is a table name — guarded against system/other-plugin table access.

// Framework-owned system tables. Plugins must reach these ONLY through the dedicated context APIs
// (context.users / context.people / context.meta / context.media / context.recordVersions / …),
// which use the RAW manager db and so bypass this guard. Direct context.db access is a security
// violation (cross-plugin PII reads, tampering with auth/sessions/plugins, etc.).

export class DatabaseContextProxy {
  private static readonly dbLimiter = new RateLimiter(5000, 60000);
  private static readonly ROW_RETURNING_METHODS = new Set(['find', 'findOne', 'insert', 'update', 'upsert']);
  private static readonly READ_METHODS = new Set(['find', 'findOne', 'count', 'groupCount', 'tableExists', 'getColumns']);
  private static readonly WRITE_METHODS = new Set(['insert', 'update', 'upsert', 'delete']);
  private static readonly SCHEMA_METHODS = new Set(['addColumn']);
  /**
   * Methods that ask about a table's SHAPE, never its rows.
   *
   * They cannot leak one tenant's data to another because they return no rows at all, so a tenant is
   * neither injected nor required for them. Naming the set once matters: the boot-access skip and the
   * tenant injection below both have to agree about which calls these are, and when they disagreed —
   * the skip let `tableExists` through as harmless while the injection still demanded a tenant — every
   * plugin that checked for its own table in `onInit` died at boot with "No tenant in the request
   * context", taking its dependants down with it.
   */
  private static readonly ROW_FREE_METHODS = new Set(['addColumn', 'tableExists', 'getColumns']);
  private static readonly TABLE_ARG_METHODS = new Set([
    ...DatabaseContextProxy.READ_METHODS,
    ...DatabaseContextProxy.WRITE_METHODS,
    ...DatabaseContextProxy.SCHEMA_METHODS,
  ]);
  /** Table-arg write methods audited per call via {@link DatabaseWriteAudit}. */
  private static readonly WRITE_AUDIT_METHODS = new Set(['insert', 'update', 'upsert', 'delete']);
  /** Write methods whose SECOND arg is the row payload — never mined for a record id in the audit resource. */
  private static readonly PAYLOAD_SECOND_ARG_METHODS = new Set(['insert', 'upsert']);
  /** Filter lives under `options.where` for these. */
  private static readonly WHERE_OPTION_METHODS = new Set(['find', 'count', 'groupCount']);
  /** Filter IS the second argument for these — not an option. */
  private static readonly WHERE_DIRECT_METHODS = new Set(['findOne', 'update', 'delete']);
  private static readonly SYSTEM_TABLES = new Set<string>(Object.values(SystemConstants.TABLE).map((t) => String(t).toLowerCase()));

  /**
   * Layer 1 of tenant isolation: the predicate the query SHOULD have carried.
   *
   * Row-level security (layer 2) already makes a missing predicate harmless, so this is not the
   * security boundary — it is what keeps the query CORRECT, and what turns an absent tenant into a
   * loud failure instead of a silently empty result set.
   *
   * `find`/`count`/`groupCount` take the filter under `options.where`; `findOne`/`update`/`delete`
   * take the where DIRECTLY as the second argument. Confusing the two is the exact shape of the
   * documented `db.find` bug — a filter at the top level is silently ignored and the query returns
   * every row — so the two forms are handled separately and explicitly.
   *
   * `insert`/`upsert` are deliberately absent: the column DEFAULT stamps the tenant from the
   * connection and WITH CHECK rejects a wrong one. Stamping here too would be a second source for
   * the same value.
   */
  private static injectTenant(prop: string, args: any[]): any[] {
    // Single-tenant deployment: no tenant exists to scope by, and injecting one would filter every
    // query to nothing. Pre-tenancy behaviour, unchanged.
    if (!TenantMode.isEnabled()) return args;
    if (!TenantScopedTableDdl.isTenantScoped(String(args[0] ?? ''))) return args;
    // A question about the table's shape has no rows to scope, so it needs no tenant to answer.
    if (DatabaseContextProxy.ROW_FREE_METHODS.has(prop)) return args;
    const tenantId = RequestContextUtils.requireTenantId();
    const next = [...args];

    if (DatabaseContextProxy.WHERE_OPTION_METHODS.has(prop)) {
      const options = { ...(next[1] ?? {}) };
      options.where = { ...(options.where ?? {}), tenantId };
      next[1] = options;
      return next;
    }
    if (DatabaseContextProxy.WHERE_DIRECT_METHODS.has(prop)) {
      next[1] = { ...(next[1] ?? {}), tenantId };
      return next;
    }
    return next;
  }

  private static denormalizeResult(result: any): any { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (result == null) return result;
    if (Array.isArray(result)) return result.map((row) => NamingStrategy.denormalizeRecord(row));
    return NamingStrategy.denormalizeRecord(result);
  }

  /**
   * Everything a row must pass through on its way out to plugin code: names denormalized to the
   * schema's camelCase, THEN `localized: true` fields collapsed to the request's locale.
   *
   * The order is load-bearing — {@link LocalizedReadResolver} looks fields up by their schema name, so
   * it has to run after the snake_case keys have been converted.
   */
  private static postProcessResult(result: any, table: unknown, manager: IPluginManagerInterface): any { // eslint-disable-line @typescript-eslint/no-explicit-any
    return LocalizedReadResolver.resolveResult(DatabaseContextProxy.denormalizeResult(result), table, manager);
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
    if (DatabaseContextProxy.SYSTEM_TABLES.has(name)) return true;
    // Another plugin's physical table (fcp_<otherslug>_…). A plugin's own prefix is allowed.
    if (PhysicalTableNameUtils.hasPlatformPrefix(name) && !name.startsWith(ownPrefix.toLowerCase())) return true;
    return false;
  }

  /**
   * Whether a forbidden-table access HARD-FAILS (throws) or is allowed-with-a-warning. Strict by
   * default (mirrors ENFORCE_PLUGIN_INTEGRITY); a deployment whose bundled plugins still do legacy
   * cross-plugin reads can set ENFORCE_PLUGIN_DB_ISOLATION=false to run in warn+audit mode while
   * those plugins are migrated to the namespace API, then flip it back on.
   */
  private static isIsolationEnforced(): boolean {
    const flag = String(process.env.ENFORCE_PLUGIN_DB_ISOLATION || '').trim().toLowerCase();
    if (['false', '0', 'no', 'off'].includes(flag)) return false;
    return true;
  }

  static createDatabaseProxy(
  plugin: ILoadedPlugin,
  manager: IPluginManagerInterface,
  security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>,
  behaviour?: { resolveLocalized?: boolean }
) {
      const { hasCapability, handleViolation, handleRateLimit } = security;
      const tablePrefix = PhysicalTableNameUtils.createPluginPrefix(plugin.manifest.slug);
      const resolveLocalized = behaviour?.resolveLocalized !== false;
      // `db.stored` — the same proxy (same guards, same rate limit, same denormalization) minus the
      // localized-field collapse, so rows read in the STORED shape. This exists for read-modify-write:
      // reading a `localized: true` field through the collapsing view and writing it back REPLACES the
      // whole locale map with one locale's value — every other language's content is silently lost.
      // Any code that patches inside a localized value must read
      // through `stored`. Lazily built once; `stored` on the stored view is itself.
      let storedView: any = null;

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

      const proxy: any = new Proxy(manager.db, {
        get: (target, prop) => {
          if (prop === 'then') return undefined;
          if (typeof prop === 'string' && DatabaseContextProxy.TABLE_ARG_METHODS.has(prop)) {
            if (!DatabaseContextProxy.dbLimiter.check(plugin.manifest.slug)) {
              handleRateLimit('database');
            }
          }

          if (prop === 'sql') return wrappedSql;
          if (prop === 'eq') return eq;
          if (prop === 'and') return and;
          if (prop === 'or') return or;
          if (prop === 'stored') {
            if (!resolveLocalized) return proxy;
            if (!storedView) {
              storedView = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security, { resolveLocalized: false });
            }
            return storedView;
          }

          // Arbitrary SQL is an explicit, separately approved escape hatch. It is never implied by
          // ordinary database read/write access.
          if (prop === 'execute') {
            if (!hasCapability('database:raw')) handleViolation('database:raw');
            const executeFn = (target as any)[prop];
            if (typeof executeFn !== 'function') return executeFn;
            return function (this: any, ...args: any[]) {
              DatabaseWriteAudit.logWrite(manager, plugin.manifest.slug, 'execute', tablePrefix, undefined);
              return executeFn.apply(this, args);
            };
          }

          if (typeof prop === 'string' && DatabaseContextProxy.TABLE_ARG_METHODS.has(prop)) {
            if (DatabaseContextProxy.READ_METHODS.has(prop) && !hasCapability('database:read')) {
              handleViolation('database:read');
            }
            if (DatabaseContextProxy.WRITE_METHODS.has(prop) && !hasCapability('database:write')) {
              handleViolation('database:write');
            }
            if (DatabaseContextProxy.SCHEMA_METHODS.has(prop) && !hasCapability('database:schema')) {
              handleViolation('database:schema');
            }
            const fn = (target as any)[prop];
            if (typeof fn !== 'function') return fn;
            const shouldDenormalize = DatabaseContextProxy.ROW_RETURNING_METHODS.has(prop);
            return function (this: any, ...args: any[]) {
              // SECURITY: deny direct access to framework system tables and other plugins' tables.
              // The framework's own context proxies (users/people/meta/media/recordVersions/…) use the
              // RAW manager db, so they are NOT affected by this guard — only plugin context.db is.
              if (DatabaseContextProxy.isForbiddenTable(args[0], tablePrefix)) {
                if (DatabaseContextProxy.isIsolationEnforced()) {
                  manager.audit.logAction(plugin.manifest.slug, 'Database Access Denied', String(args[0]), 'blocked');
                  throw new Error(
                    `Security Violation: plugin "${plugin.manifest.slug}" attempted direct context.db.${prop} on the protected table "${String(args[0])}". `
                    + 'Plugins may only access their OWN tables via context.db; use the dedicated context API '
                    + '(context.users / context.people / context.meta / context.media / context.recordVersions / …) for framework data.',
                  );
                }
                // Warn mode (ENFORCE_PLUGIN_DB_ISOLATION=false): surface the violation, allow the call.
                manager.audit.logAction(plugin.manifest.slug, 'Database Access Warning', String(args[0]), 'allowed');
                console.warn(
                  `[plugin-db-isolation] plugin "${plugin.manifest.slug}" accessed protected table "${String(args[0])}" via context.db.${prop} `
                  + '— allowed because ENFORCE_PLUGIN_DB_ISOLATION=false. Migrate to the namespace API / dedicated context API, then re-enable isolation.',
                );
              }
              // Audit the write per call, with the table (and the where's record id) as the
              // resource. `insert`/`upsert`'s second arg is the PAYLOAD, never mined for an id —
              // only update/delete carry a where. Fire-and-forget inside logWrite; a denied call
              // above never reaches this line, so nothing is logged 'allowed' that was blocked.
              if (DatabaseContextProxy.WRITE_AUDIT_METHODS.has(prop)) {
                DatabaseWriteAudit.logWrite(
                  manager,
                  plugin.manifest.slug,
                  prop,
                  tablePrefix,
                  args[0],
                  DatabaseContextProxy.PAYLOAD_SECOND_ARG_METHODS.has(prop) ? undefined : args[1],
                );
              }
              // A reactor Enum member is an object and SQL binding does not stringify it, so an Enum
              // passed in a payload or a `where` would reach the driver as an object. Coerced here —
              // the one point every plugin DB call passes through — rather than at ~1,500 call sites
              // that tsc cannot police. See EnumValueCoercion.
              const table = args[0];
              // Plugin boot work has no tenant. Skip it loudly rather than failing the plugin or
              // running it unscoped — see UntenantedBootAccess.
              if (!DatabaseContextProxy.ROW_FREE_METHODS.has(prop)
                && UntenantedBootAccess.shouldSkip(table)) {
                return UntenantedBootAccess.skip(plugin.manifest.slug, prop, table);
              }
              const scoped = DatabaseContextProxy.injectTenant(prop, args);
              const out = fn.apply(this, EnumValueCoercion.coerceArguments(scoped));
              if (shouldDenormalize) {
                const postProcess = (rows: any) => (resolveLocalized
                  ? DatabaseContextProxy.postProcessResult(rows, table, manager)
                  : DatabaseContextProxy.denormalizeResult(rows));
                if (out && typeof out.then === 'function') {
                  return out.then(postProcess);
                }
                return postProcess(out);
              }
              return out;
            };
          }

          if (typeof prop === 'symbol') return undefined;
          manager.audit.logAction(plugin.manifest.slug, 'Database Property Denied', String(prop), 'blocked');
          throw new Error(
            `Security Violation: plugin "${plugin.manifest.slug}" cannot access context.db.${String(prop)}. `
            + 'Only the declared plugin database API is exposed.',
          );
        }
      });

      return proxy;
  }
}
