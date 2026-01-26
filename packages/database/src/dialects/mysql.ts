import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { IDatabaseManager } from '../index';

export class MysqlDatabaseManager implements IDatabaseManager {
  private pool: mysql.Pool;
  public readonly drizzle: any;
  public readonly dialect = 'mysql' as const;

  constructor(connection: string) {
    this.pool = mysql.createPool(connection);
    this.drizzle = drizzle(this.pool);
  }

  async connect() {
    await this.pool.getConnection();
  }

  async execute(query: any) {
    return this.drizzle.execute(query);
  }
}
