export interface IDatabaseManager {
  readonly drizzle: any;
  readonly dialect: string;
  execute(query: any): Promise<any>;
  connect(): Promise<void>;
  find(tableOrName: any, options?: any): Promise<any[]>;
  findOne(tableOrName: any, where: any): Promise<any | null>;
  insert(tableOrName: any, data: any): Promise<any>;
  update(tableOrName: any, where: any, data: any): Promise<any>;
  delete(tableOrName: any, where: any): Promise<boolean>;
  count(tableName: string, where?: any): Promise<number>;
  
  // Schema Management
  getTables(): Promise<string[]>;
  tableExists(tableName: string): Promise<boolean>;
  getColumns(tableName: string): Promise<string[]>;
  createTable(collection: any): Promise<void>;
  addColumn(tableName: string, field: any): Promise<void>;
  ensureMigrationTable(tableName: string): Promise<void>;
  resetDatabase(): Promise<void>;
}
