import type { IDatabaseManager, DatabaseDriverCreator } from './types';
import { TableResolver } from './table-resolver';
import type { DatabaseDialectDefinition } from './dialects/database-dialect-definition.interfaces';
import type { DatabaseDialectResolver } from './dialects/database-dialect-resolver.interfaces';
import { DatabaseDialectDefinitionLoader } from './dialects/database-dialect-definition-loader';
import { DatabaseDialectRegistry } from './dialects/database-dialect-registry';

/**
 * Universal Database Factory.
 * Resolves the appropriate dialect manager based on the connection string.
 * Supports dynamic registration of custom dialects.
 */
export class DatabaseFactory {
  private static drivers: Map<string, DatabaseDriverCreator> = new Map();

  static register(protocol: string, creator: DatabaseDriverCreator) {
    this.drivers.set(protocol, creator);
  }

  static registerDialectDefinition(definition: DatabaseDialectDefinition): void {
    DatabaseDialectRegistry.registerDefinition(definition);
  }

  static registerDialectResolver(resolver: DatabaseDialectResolver): void {
    DatabaseDialectRegistry.registerResolver(resolver);
  }

  static createBackupHandler(connection: string): ReturnType<typeof DatabaseDialectRegistry.resolveBackupHandler> {
    return DatabaseDialectRegistry.resolveBackupHandler(connection);
  }

  static create(connection: string): IDatabaseManager {
    if (!connection) {
        throw new Error('Database connection string (DATABASE_URL) is missing. Please check your environment configuration.');
    }

    // Initialize default drivers if not already registered
    if (this.drivers.size === 0) {
      this.registerDefaults();
    }

    const aliasProtocol = this.resolveDialect(connection);
    const processedConn = connection;
    const creator = this.drivers.get(aliasProtocol);

    if (!creator) {
      const available = Array.from(this.drivers.keys()).join(', ');
      throw new Error(`Unsupported database dialect "${aliasProtocol}" for connection string. Available: ${available}`);
    }

    const manager = creator(processedConn);

    // Return a proxy that handles @plugin/table resolution
    return new Proxy(manager, {
      get: (target, prop) => {
        const value = (target as any)[prop];
        if (typeof value === 'function') {
          return (...args: any[]) => {
            // Intercept methods that take a table name as first argument
            const tableMethods = ['find', 'findOne', 'insert', 'update', 'delete', 'count', 'syncCollection', 'tableExists', 'getColumns', 'addColumn'];
            if (typeof prop === 'string' && tableMethods.includes(prop) && args.length > 0) {
              args[0] = TableResolver.resolve(args[0]);
            }
            return value.apply(target, args);
          };
        }
        return value;
      }
    });
  }

  static resolveDialect(connection: string): string {
    return DatabaseDialectRegistry.resolve(connection);
  }

  private static registerDefaults() {
    if (typeof window !== 'undefined') {
      return;
    }

    for (const definition of DatabaseDialectDefinitionLoader.load()) {
      for (const protocol of definition.protocols) {
        if (!this.drivers.has(protocol)) {
          this.register(protocol, definition.createManager.bind(definition));
        }
      }
    }
  }
}
