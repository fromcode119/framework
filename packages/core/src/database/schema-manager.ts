import type { ICollection } from '@core/interfaces/collection.interface';
import { IDatabaseManager } from '@fromcode119/database';
import { Logger } from '@core/logging';
import { SystemConstants } from '@core/constants/system.constants';
import { EntitySchemaPlanService } from '@core/database/entity-schema-plan-service';
import type { IEntitySchemaPlan } from '@core/database/interfaces/entity-schema-plan.interface';
import type { IField } from '@core/interfaces/field.interface';

export class SchemaManager {
  private logger = new Logger({ namespace: 'schema-manager' });
  private entitySchemaPlan = new EntitySchemaPlanService();

  constructor(private db: IDatabaseManager) {}

  async syncCollection(collection: ICollection): Promise<void> {
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
        // The database layer types field `type` as a plain string, so flatten the FieldType members
        // to their bare values at this boundary rather than leaking enum instances into the dialects.
        await this.db.createTable(SchemaManager.toSchemaCollection(collection));
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

  async planCollection(collection: ICollection, tableExists?: boolean): Promise<IEntitySchemaPlan> {
    const tableName = collection.slug;
    const exists = typeof tableExists === 'boolean'
      ? tableExists
      : await this.db.tableExists(tableName);
    const existingColumnNames = exists ? await this.db.getColumns(tableName) : [];

    return this.entitySchemaPlan.buildPlan(collection, exists, existingColumnNames);
  }

  /** Flatten a collection's field types to bare strings for the database layer. */
  private static toSchemaCollection(collection: ICollection): any {
    return { ...collection, fields: (collection.fields || []).map((field) => SchemaManager.toSchemaField(field)) };
  }

  /** Flatten one field's `type` enum member to its bare string. */
  private static toSchemaField(field: IField): any {
    return { ...field, type: String(field.type) };
  }

  private async updateTable(plan: IEntitySchemaPlan): Promise<void> {
    for (const column of plan.missingColumns) {
      this.logger.info(`Adding column ${column.columnName} to ${plan.tableName}...`);
      await this.db.addColumn(plan.tableName, SchemaManager.toSchemaField(column.field));
    }
  }

  private warnUnsupportedIndexes(plan: IEntitySchemaPlan): void {
    if (plan.unsupportedIndexes.length === 0) {
      return;
    }

    this.logger.warn(
      `Collection "${plan.tableName}" declares indexes that are tracked in metadata but not auto-created yet: ` +
      plan.unsupportedIndexes.join(', ')
    );
  }

  private async persistSchemaFingerprint(plan: IEntitySchemaPlan): Promise<void> {
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
