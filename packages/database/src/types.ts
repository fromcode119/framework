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

export type TableNameResolver = (name: any) => any;

export type DatabaseDriverCreator = (connection: string) => IDatabaseManager;
