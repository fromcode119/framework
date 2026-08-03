import type { ISchemaField } from '@database/interfaces/schema-field.interface';
import type { ISchemaCollection } from '@database/interfaces/schema-collection.interface';

/**
 * Interface representing a database manager that provides access to Drizzle ORM
 * and high-level CRUD operations.
 */
export interface IDatabaseManager {
  readonly drizzle: any; 
  readonly dialect: string;
  
  // Dialect-aware operators
  readonly like: (column: any, value: any) => any;
  
  // Standard operators (proxied for driver-only usage)
  readonly eq: any;
  readonly ne: any;
  readonly and: any;
  readonly or: any;
  readonly isNull: any;
  readonly isNotNull: any;
  readonly inArray: any;
  readonly desc: any;
  readonly asc: any;

  execute(query: any): Promise<any>;
  connect(): Promise<void>;
  
  // High-level agnostic API
  find(tableOrName: any, options?: { 
    where?: any; 
    limit?: number; 
    offset?: number; 
    orderBy?: any;
    columns?: Record<string, boolean>;
    joins?: any[]; // Can be JoinClause[] or Drizzle-style joins
    /** Push a LIKE/ILIKE filter to the DB. columns are OR-ed, ANDed with where. */
    search?: { columns: string[]; value: string };
  }): Promise<any[]>;
  
  findOne(tableOrName: any, where: any): Promise<any | null>;
  
  insert(tableOrName: any, data: any): Promise<any>;
  
  update(tableOrName: any, where: any, data: any): Promise<any>;
  
  upsert(tableOrName: any, data: any, options: { target: string | string[]; set: any }): Promise<any>;
  
  delete(tableOrName: any, where: any): Promise<boolean>;
  
  count(tableOrName: any, options?: { where?: any; joins?: any[] }): Promise<number>;

  // Schema Management (Agnostic)
  getTables(): Promise<string[]>;
  tableExists(tableName: string): Promise<boolean>;
  getColumns(tableName: string): Promise<string[]>;
  createTable(collection: ISchemaCollection): Promise<void>;
  addColumn(tableName: string, field: ISchemaField): Promise<void>;
  ensureMigrationTable(tableName: string): Promise<void>;
  resetDatabase(): Promise<void>;
}
