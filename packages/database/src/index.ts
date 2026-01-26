import { Pool, PoolClient, QueryResultRow } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
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
  readonly drizzle: any; // Using any for cross-dialect compatibility
  readonly dialect: 'postgresql' | 'mysql' | 'sqlite';
  execute(query: any): Promise<any>;
  select(...args: any[]): any;
  insert(...args: any[]): any;
  update(...args: any[]): any;
  delete(...args: any[]): any;
}

/**
 * Default PostgreSQL implementation of IDatabaseManager.
 */
export class DatabaseManager implements IDatabaseManager {
  private pool?: Pool;
  public readonly drizzle: NodePgDatabase<any>;
  public readonly dialect = 'postgresql';

  constructor(connection: string | NodePgDatabase<any>) {
    if (typeof connection === 'string') {
      this.pool = new Pool({
        connectionString: connection
      });
      this.drizzle = drizzle(this.pool);
      
      this.pool.on('error', (err) => {
        console.error('[DatabaseManager] Unexpected error on idle client', err);
      });
    } else {
      this.drizzle = connection;
    }
  }

  async connect() {
    if (this.pool) {
      try {
        const client = await this.pool.connect();
        client.release();
      } catch (err) {
        console.error('[DatabaseManager] Failed to connect to database', err);
        throw err;
      }
    }
  }

  // Framework DB Abstraction methods
  async execute(query: any) {
    return this.drizzle.execute(query);
  }

  select(...args: any[]) {
    return (this.drizzle.select as any)(...args);
  }

  insert(...args: any[]) {
    return (this.drizzle.insert as any)(...args);
  }

  update(...args: any[]) {
    return (this.drizzle.update as any)(...args);
  }

  delete(...args: any[]) {
    return (this.drizzle.delete as any)(...args);
  }
}
