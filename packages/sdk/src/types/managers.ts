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

export interface IMediaManager {
  upload(file: Buffer, filename: string): Promise<{ url: string; path: string; width?: number; height?: number; size: number; mimeType: string }>;
  remove(filepath: string): Promise<void>;
}

export interface IEmailManager {
  send(options: { to: string; subject: string; html: string; from?: string; text?: string }): Promise<any>;
}

export interface ICacheManager {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
}
