import { PhysicalTableNameUtils } from '@fromcode119/database';
import { sql, eq, and, or } from 'drizzle-orm';
import { LoadedPlugin } from '../../types';
import type { PluginManagerInterface } from './utils.interfaces';
import { ContextSecurityProxy } from './utils';
import { RateLimiter } from '../../security/rate-limiter';

const dbLimiter = new RateLimiter(5000, 60000);

export class DatabaseContextProxy {
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

          return (target as any)[prop];
        }
      });

  }
}
