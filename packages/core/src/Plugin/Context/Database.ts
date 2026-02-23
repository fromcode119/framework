import { sql, eq, and, or } from 'drizzle-orm';
import { LoadedPlugin } from '../../types';
import { PluginManagerInterface, createSecurityHelpers } from './utils';
import { RateLimiter } from '../../security/rate-limiter';

const dbLimiter = new RateLimiter(5000, 60000);

export function createDatabaseProxy(
  plugin: LoadedPlugin,
  manager: PluginManagerInterface,
  security: ReturnType<typeof createSecurityHelpers>
) {
  const { hasCapability, handleViolation, handleRateLimit } = security;
  const tablePrefix = `fcp_${plugin.manifest.slug.replace(/-/g, '_')}_`;

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
