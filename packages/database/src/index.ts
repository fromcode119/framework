
export * from './schema';
export * from './dynamic-schema';
export * from 'drizzle-orm/pg-core';
export { 
  sql, 
  and, 
  or, 
  eq, 
  ne, 
  gt, 
  gte, 
  lt, 
  lte, 
  inArray, 
  notInArray, 
  isNull, 
  isNotNull, 
  exists, 
  notExists, 
  between, 
  notBetween, 
  like, 
  notLike, 
  ilike, 
  notIlike, 
  not, 
  asc, 
  desc, 
  count, 
  avg, 
  sum, 
  min, 
  max,
  relations,
  extractTablesRelationalConfig
} from 'drizzle-orm';

/**
 * Interface representing a database manager that provides access to Drizzle ORM.
 * This can be implemented for different database engines (Postgres, MySQL, SQLite).
 */
export interface IDatabaseManager {
  readonly drizzle: any; 
  readonly dialect: 'postgresql' | 'mysql' | 'sqlite';
  execute(query: any): Promise<any>;
  connect(): Promise<void>;
}

/**
 * Universal Database Factory.
 * Resolves the appropriate dialect manager based on the connection string.
 * Uses dynamic loading to keep the base package clean.
 */
export class DatabaseFactory {
  static create(connection: string): IDatabaseManager {
    if (!connection) {
        throw new Error('Database connection string (DATABASE_URL) is missing. Please check your environment configuration.');
    }
    if (connection.startsWith('postgres://') || connection.startsWith('postgresql://')) {
        const { PostgresDatabaseManager } = require('./dialects/postgres');
        return new PostgresDatabaseManager(connection);
    } else if (connection.startsWith('mysql://')) {
        const { MysqlDatabaseManager } = require('./dialects/mysql');
        return new MysqlDatabaseManager(connection);
    } else if (connection.endsWith('.db') || connection.startsWith('sqlite:')) {
        const { SqliteDatabaseManager } = require('./dialects/sqlite');
        return new SqliteDatabaseManager(connection);
    } else {
        throw new Error(`Unsupported database dialect for connection string: ${connection}`);
    }
  }
}

// Legacy alias for compatibility during migration
export class DatabaseManager {
    private instance: IDatabaseManager;
    constructor(connection: string) {
        this.instance = DatabaseFactory.create(connection);
    }
    get drizzle() { return this.instance.drizzle; }
    get dialect() { return this.instance.dialect; }
    async connect() { return this.instance.connect(); }
    async execute(query: any) { return this.instance.execute(query); }
    select(...args: any[]) { return this.instance.drizzle.select(...args); }
    insert(...args: any[]) { return this.instance.drizzle.insert(...args); }
    update(...args: any[]) { return this.instance.drizzle.update(...args); }
    delete(...args: any[]) { return this.instance.drizzle.delete(...args); }
}
