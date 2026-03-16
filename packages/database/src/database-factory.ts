import type { IDatabaseManager, DatabaseDriverCreator } from './types';
import { TableResolver } from './table-resolver';

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

  static create(connection: string): IDatabaseManager {
    if (!connection) {
        throw new Error('Database connection string (DATABASE_URL) is missing. Please check your environment configuration.');
    }

    // Initialize default drivers if not already registered
    if (this.drivers.size === 0) {
      this.registerDefaults();
    }

    // Resolve protocol from connection string
    let protocol = 'postgres';
    let processedConn = connection;

    if (connection.includes('://')) {
        const url = new URL(connection);
        protocol = url.protocol.replace(':', '');
    } else if (connection.endsWith('.db') || connection === ':memory:') {
        protocol = 'sqlite';
    } else if (connection.startsWith('file:')) {
        protocol = 'sqlite';
    }

    // Map postgresql -> postgres for convenience
    const aliasProtocol = protocol === 'postgresql' ? 'postgres' : protocol;
    const creator = this.drivers.get(aliasProtocol);

    if (!creator) {
      const available = Array.from(this.drivers.keys()).join(', ');
      throw new Error(`Unsupported database dialect "${protocol}" for connection string. Available: ${available}`);
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

  private static registerDefaults() {
    if (typeof window !== 'undefined') {
      return;
    }

    this.register('postgres', (conn) => {
      const { PostgresDatabaseManager } = require('./dialects/postgres-database-manager');
      return new PostgresDatabaseManager(conn);
    });
    this.register('postgresql', (conn) => {
      const { PostgresDatabaseManager } = require('./dialects/postgres-database-manager');
      return new PostgresDatabaseManager(conn);
    });
    this.register('mysql', (conn) => {
      const { MysqlDatabaseManager } = require('./dialects/mysql-database-manager');
      return new MysqlDatabaseManager(conn);
    });
    this.register('sqlite', (conn) => {
      const { SqliteDatabaseManager } = require('./dialects/sqlite-database-manager');
      return new SqliteDatabaseManager(conn);
    });
  }
}
