import { Collection } from '../types';
import { IDatabaseManager } from '@fromcode119/database';
import { Logger } from '../logging';

export class SchemaManager {
  private logger = new Logger({ namespace: 'schema-manager' });

  constructor(private db: IDatabaseManager) {}

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  async syncCollection(collection: Collection): Promise<void> {
    const tableName = collection.slug;
    this.logger.info(`Syncing schema for collection: ${tableName} (${this.db.dialect})`);

    try {
      const exists = await this.db.tableExists(tableName);

      if (!exists) {
        this.logger.info(`Creating table ${tableName}...`);
        await this.db.createTable(collection);
      } else {
        await this.updateTable(collection);
      }
    } catch (error) {
      this.logger.error(`Failed to sync schema for ${tableName}: ${error}`);
      throw error;
    }
  }

  private async updateTable(collection: Collection): Promise<void> {
    const tableName = collection.slug;
    const existingColumnNames = await this.db.getColumns(tableName);

    for (const field of collection.fields) {
      if (field.name === 'id') continue;
      
      const dbName = this.toSnakeCase(field.name);
      if (!existingColumnNames.includes(dbName.toLowerCase())) {
        this.logger.info(`Adding column ${dbName} to ${tableName}...`);
        await this.db.addColumn(tableName, field);
      }
    }
  }
}