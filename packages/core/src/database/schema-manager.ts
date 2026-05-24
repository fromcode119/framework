import { Collection } from '../types';
import { IDatabaseManager } from '@fromcode119/database';
import { Logger } from '../logging';
import { SystemConstants } from '../constants';
import { EntitySchemaPlanService } from './entity-schema-plan-service';
import type { EntitySchemaPlan } from './entity-schema-plan.interfaces';

export class SchemaManager {
  private logger = new Logger({ namespace: 'schema-manager' });
  private entitySchemaPlan = new EntitySchemaPlanService();

  constructor(private db: IDatabaseManager) {}

  async syncCollection(collection: Collection): Promise<void> {
    const tableName = collection.slug;
    if (!tableName) {
      throw new Error(
        `syncCollection called with a collection missing a slug. ` +
        `Pass the collection object (e.g. MyCollection.collection), not the class itself.`
      );
    }
    this.logger.info(`Syncing schema for collection: ${tableName} (${this.db.dialect})`);

    try {
      const exists = await this.db.tableExists(tableName);
      const plan = await this.planCollection(collection, exists);

      if (!exists) {
        this.logger.info(`Creating table ${tableName}...`);
        await this.db.createTable(collection);
      } else {
        await this.updateTable(plan);
      }

      this.warnUnsupportedIndexes(plan);
      await this.persistSchemaFingerprint(plan);
    } catch (error) {
      this.logger.error(`Failed to sync schema for ${tableName}: ${error}`);
      throw error;
    }
  }

  async planCollection(collection: Collection, tableExists?: boolean): Promise<EntitySchemaPlan> {
    const tableName = collection.slug;
    const exists = typeof tableExists === 'boolean'
      ? tableExists
      : await this.db.tableExists(tableName);
    const existingColumnNames = exists ? await this.db.getColumns(tableName) : [];

    return this.entitySchemaPlan.buildPlan(collection, exists, existingColumnNames);
  }

  private async updateTable(plan: EntitySchemaPlan): Promise<void> {
    for (const column of plan.missingColumns) {
      this.logger.info(`Adding column ${column.columnName} to ${plan.tableName}...`);
      await this.db.addColumn(plan.tableName, column.field);
    }
  }

  private warnUnsupportedIndexes(plan: EntitySchemaPlan): void {
    if (plan.unsupportedIndexes.length === 0) {
      return;
    }

    this.logger.warn(
      `Collection "${plan.tableName}" declares indexes that are tracked in metadata but not auto-created yet: ` +
      plan.unsupportedIndexes.join(', ')
    );
  }

  private async persistSchemaFingerprint(plan: EntitySchemaPlan): Promise<void> {
    const metaTableExists = await this.db.tableExists(SystemConstants.TABLE.META);
    if (!metaTableExists) {
      return;
    }

    const key = `entity_schema:${plan.tableName}`;
    const value = JSON.stringify({
      fingerprint: plan.fingerprint,
      updatedAt: new Date().toISOString(),
    });
    const existing = await this.db.findOne(SystemConstants.TABLE.META, { key });

    if (existing) {
      await this.db.update(SystemConstants.TABLE.META, { key }, { value });
      return;
    }

    await this.db.insert(SystemConstants.TABLE.META, {
      key,
      value,
      description: `Entity schema fingerprint for ${plan.tableName}`,
      group: 'Entity Schema',
    });
  }
}
