import { PhysicalTableNameUtils } from '@fromcode119/database/physical-table-name-utils';
import { NamingStrategy } from '@fromcode119/database';
import { sql, eq, and, or } from 'drizzle-orm';
import { LoadedPlugin } from '../../types';
import type { PluginManagerInterface } from './utils.interfaces';
import { ContextSecurityProxy } from './utils';
import { RateLimiter } from '../../security/rate-limiter';

const dbLimiter = new RateLimiter(5000, 60000);

// Plugins read with the schema's camelCase field names. Raw-SQL paths in
// the dialects return rows keyed by snake_case DB columns; convert top-level
// keys here so plugin code can stick to one canonical name.
const ROW_RETURNING_METHODS = new Set(['find', 'findOne', 'insert', 'update']);

export class DatabaseContextProxy {
  private static denormalizeResult(result: any): any { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (result == null) return result;
    if (Array.isArray(result)) return result.map((row) => NamingStrategy.denormalizeRecord(row));
    return NamingStrategy.denormalizeRecord(result);
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

          if (typeof prop === 'string' && ROW_RETURNING_METHODS.has(prop)) {
            const fn = (target as any)[prop];
            if (typeof fn !== 'function') return fn;
            return function (this: any, ...args: any[]) {
              const out = fn.apply(this, args);
              if (out && typeof out.then === 'function') {
                return out.then(DatabaseContextProxy.denormalizeResult);
              }
              return DatabaseContextProxy.denormalizeResult(out);
            };
          }

          return (target as any)[prop];
        }
      });

  }
}
