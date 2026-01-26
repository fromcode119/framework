import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { IDatabaseManager } from '../index';

export class SqliteDatabaseManager implements IDatabaseManager {
  private sqlite: Database.Database;
  public readonly drizzle: any;
  public readonly dialect = 'sqlite' as const;

  constructor(connection: string) {
    const dbPath = connection.startsWith('sqlite:') ? connection.replace('sqlite:', '') : connection;
    this.sqlite = new Database(dbPath);
    this.drizzle = drizzle(this.sqlite);
  }

  async connect() {
    // SQLite is synchronous and connects immediately
  }

  async execute(query: any) {
    return this.drizzle.execute(query);
  }
}
