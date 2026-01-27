
export * from './schema';
export * from './dynamic-schema';
export { sql, and, or, eq, ne, gt, gte, lt, lte, inArray, notInArray, isNull, isNotNull, exists, notExists, between, notBetween, like, notLike, ilike, notIlike, not, asc, desc, count, avg, sum, min, max, relations, extractTablesRelationalConfig } from 'drizzle-orm';
export * from 'drizzle-orm/pg-core';

/**
 * Interface representing a database manager that provides access to Drizzle ORM
 * and high-level CRUD operations.
 */
export interface IDatabaseManager {
  readonly drizzle: any; 
  readonly dialect: string;
  execute(query: any): Promise<any>;
  connect(): Promise<void>;
  
  // High-level agnostic API
  find(tableOrName: any, options?: { 
    where?: any; 
    limit?: number; 
    offset?: number; 
    orderBy?: any;
    columns?: Record<string, boolean>;
  }): Promise<any[]>;
  
  findOne(tableOrName: any, where: any): Promise<any | null>;
  
  insert(tableOrName: any, data: any): Promise<any>;
  
  update(tableOrName: any, where: any, data: any): Promise<any>;
  
  delete(tableOrName: any, where: any): Promise<boolean>;
  
  count(tableName: string, where?: any): Promise<number>;
}

export type DatabaseDriverCreator = (connection: string) => IDatabaseManager;

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

    const url = new URL(connection.includes('://') ? connection : `sqlite://${connection}`);
    const protocol = url.protocol.replace(':', '');
    
    // SQLite special case for files
    if (connection.endsWith('.db') && !connection.includes('://')) {
        const creator = this.drivers.get('sqlite');
        if (creator) return creator(connection);
    }

    const creator = this.drivers.get(protocol);
    if (!creator) {
      throw new Error(`Unsupported database dialect for connection string: ${connection} (Protocol: ${protocol})`);
    }

    return creator(connection);
  }

  private static registerDefaults() {
    this.register('postgres', (conn) => {
      const { PostgresDatabaseManager } = require('./dialects/postgres');
      return new PostgresDatabaseManager(conn);
    });
    this.register('postgresql', (conn) => {
      const { PostgresDatabaseManager } = require('./dialects/postgres');
      return new PostgresDatabaseManager(conn);
    });
    this.register('mysql', (conn) => {
      const { MysqlDatabaseManager } = require('./dialects/mysql');
      return new MysqlDatabaseManager(conn);
    });
    this.register('sqlite', (conn) => {
      const { SqliteDatabaseManager } = require('./dialects/sqlite');
      return new SqliteDatabaseManager(conn);
    });
  }
}

// Legacy alias for compatibility during migration
export class DatabaseManager implements IDatabaseManager {
    private instance: IDatabaseManager;
    constructor(connection: string) {
        this.instance = DatabaseFactory.create(connection);
    }
    get drizzle() { return this.instance.drizzle; }
    get dialect() { return this.instance.dialect; }
    async connect() { return this.instance.connect(); }
    async execute(query: any) { return this.instance.execute(query); }
    
    // Delegate new high-level methods
    async find(tableName: string, options?: any) { return this.instance.find(tableName, options); }
    async findOne(tableName: string, where: any) { return this.instance.findOne(tableName, where); }
    async insert(tableName: string, data: any) { return this.instance.insert(tableName, data); }
    async update(tableName: string, where: any, data: any) { return this.instance.update(tableName, where, data); }
    async delete(tableName: string, where: any) { return this.instance.delete(tableName, where); }
    async count(tableName: string, where?: any) { return this.instance.count(tableName, where); }
}
