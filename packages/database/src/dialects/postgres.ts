import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { IDatabaseManager } from '../index';

export class PostgresDatabaseManager implements IDatabaseManager {
  private pool: Pool;
  public readonly drizzle: any;
  public readonly dialect = 'postgresql' as const;

  constructor(connection: string) {
    this.pool = new Pool({ connectionString: connection });
    this.drizzle = drizzle(this.pool);
  }

  async connect() {
    const client = await this.pool.connect();
    client.release();
  }

  async execute(query: any) {
    return this.drizzle.execute(query);
  }
}
