import type { IEntitySchemaPlan } from '@core/database/interfaces/entity-schema-plan.interface';
import { SystemConstants } from '@core/constants/system.constants';
import type { Logger } from '@core/logging';
import type { IDatabaseManager } from '@fromcode119/database';
import { NamingStrategy, SchemaReconcileState } from '@fromcode119/database';

/**
 * Applies the parts of a collection's declaration that the CREATE never covered.
 *
 * A field's `unique` and `required` were only ever emitted when the COLUMN was created, so declaring
 * either on a column that already existed did nothing at all — silently. This reconciles them after
 * the fact, and records the fingerprint that lets the next boot skip the work.
 *
 * REPORTS RATHER THAN THROWS, throughout. An existing table may hold duplicates that make a UNIQUE
 * impossible, or an index shape this driver cannot express; refusing to start the deployment over
 * one plugin's declaration is a worse answer than saying so and leaving the column unenforced.
 *
 * Split out of `SchemaManager`. Note it is NOT `SchemaReconciliationService` next door: that one is
 * the CONTRACT half of expand/contract and proposes DROPS a human must approve. This one only ever
 * adds or relaxes, which is why it can act on its own.
 */
export class DeclaredSchemaReconciler {
  constructor(
    private readonly db: IDatabaseManager,
    private readonly logger: Logger,
  ) {}

  /**
   * Create a unique that a field declares but the table does not carry.
   *
   * `unique: true` was only ever emitted when the COLUMN was created — inline on CREATE TABLE, or on
   * ADD COLUMN. Declaring it on a column that already existed did nothing at all: the plan
   * fingerprinted it, and no DDL followed. So a plugin author who added the constraint to an
   * existing field got silence, and the only way to enforce it was to issue the DDL by hand — which
   * is exactly what one plugin did, on the request connection, which is not the table's owner, so it failed
   * on every boot and the uniqueness was never enforced.
   *
   * The driver decides HOW — it owns the catalog query and the DDL — and reports back. A driver that
   * cannot do it answers `unsupported`, which is said ONCE per sync rather than per column: it is a
   * property of the deployment, not of this table.
   *
   * A failure does not take the boot down: an existing table may hold duplicates that make the
   * constraint impossible, and refusing to start is a worse answer than reporting it.
   */
  async ensureDeclaredUniques(plan: IEntitySchemaPlan): Promise<void> {
    if (plan.declaredUniques.length === 0) return;

    for (const column of plan.declaredUniques) {
      const outcome = await this.db.ensureDeclaredUnique(plan.tableName, column);

      if (outcome.state === SchemaReconcileState.CHANGED) {
        this.logger.info(`Added the declared UNIQUE on ${plan.tableName}.${column}.`);
      } else if (outcome.state === SchemaReconcileState.FAILED) {
        this.logger.warn(
          `Could not add the declared UNIQUE on ${plan.tableName}.${column}: ${outcome.reason}. `
          + 'Existing duplicate values are the usual cause; the constraint stays unenforced until they are resolved.'
        );
      } else if (outcome.state === SchemaReconcileState.UNSUPPORTED) {
        // Once, then stop asking: every remaining column would say the same thing.
        this.logger.warn(
          `Declared UNIQUE rules cannot be reconciled on this driver, so ${plan.tableName} keeps `
          + `whatever its table was created with. ${outcome.reason}`
        );
        return;
      }
    }
  }

  /**
   * Drop a NOT NULL the schema no longer declares.
   *
   * The mirror of `ensureDeclaredUniques`, and the same gap from the other side: `required: false`
   * was only honoured when the column was CREATED, so relaxing a field on an existing table changed
   * the admin and nothing else — the database went on refusing writes the form presents as optional.
   *
   * Relax-only. Nothing here ever ADDS a NOT NULL: the rows that are already NULL would need a value
   * and inventing one is forbidden. Tightening a column stays a migration someone writes.
   */
  async relaxDeclaredOptionals(plan: IEntitySchemaPlan): Promise<void> {
    if (plan.declaredOptionals.length === 0) return;

    for (const column of plan.declaredOptionals) {
      const outcome = await this.db.ensureDeclaredNullable(plan.tableName, column);

      if (outcome.state === SchemaReconcileState.CHANGED) {
        this.logger.info(`${plan.tableName}.${column} is optional in the schema; dropped its NOT NULL.`);
      } else if (outcome.state === SchemaReconcileState.FAILED) {
        this.logger.warn(
          `Could not relax NOT NULL on ${plan.tableName}.${column}: ${outcome.reason}. `
          + 'Writes that leave it empty will go on being refused until this is resolved.'
        );
      } else if (outcome.state === SchemaReconcileState.UNSUPPORTED) {
        // Once per sync, not per column: it is a property of the driver, not of this table.
        return;
      }
    }
  }

  /**
   * Drop the NOT NULL of a column NOTHING declares any more.
   *
   * A plugin that removes a required field leaves its column behind — deliberately, since dropping it
   * waits for a person — but the column keeps the NOT NULL it was created with, and nothing writes it
   * again. From then on every insert into the table is refused: removing a field made the collection
   * impossible to add to. Relaxing is the safe half of what a drop would do: no value is touched or
   * removed, and a plugin that declares the column again still validates it in the application.
   */
  async relaxUndeclared(plan: IEntitySchemaPlan): Promise<void> {
    for (const column of plan.undeclaredColumns) {
      const outcome = await this.db.ensureDeclaredNullable(plan.tableName, column);
      if (outcome.state === SchemaReconcileState.CHANGED) {
        this.logger.info(`${plan.tableName}.${column} is declared by nothing; dropped its NOT NULL so the table stays writable.`);
      } else if (outcome.state === SchemaReconcileState.FAILED) {
        this.logger.warn(`Could not relax NOT NULL on undeclared ${plan.tableName}.${column}: ${outcome.reason}.`);
      } else if (outcome.state === SchemaReconcileState.UNSUPPORTED) {
        return;
      }
    }
  }

  /**
   * Gives an existing table's `created_at` / `updated_at` the `DEFAULT CURRENT_TIMESTAMP` it lacks.
   *
   * A collection that declares its own `createdAt` field got a column WITHOUT that default, so rows
   * written without an explicit value had no creation date. Adding a default touches no existing row;
   * it is never replaced when one is there.
   */
  /**
   * Converts an existing TEXT column the collection declares as a date or datetime to `timestamptz`.
   *
   * Every `datetime` field used to be stored as TEXT. Only columns whose every value parses are
   * converted; the rest are named in the log and left exactly as they are.
   */
  async convertTextPointInTimeColumns(plan: IEntitySchemaPlan): Promise<void> {
    const missing = new Set(plan.missingColumns.map((column) => column.columnName));
    const columns = (plan.collection.fields || [])
      .filter((field) => ['date', 'datetime'].includes(String(field.type)))
      .map((field) => NamingStrategy.toSnakeCase(field.name))
      .filter((column) => !missing.has(column));

    for (const column of columns) {
      const outcome = await this.db.ensurePointInTimeColumn(plan.tableName, column);

      if (outcome.state === SchemaReconcileState.CHANGED) {
        this.logger.info(`${plan.tableName}.${column} was stored as text; it is now a timezone-aware timestamp.`);
      } else if (outcome.state === SchemaReconcileState.FAILED) {
        this.logger.warn(`${plan.tableName}.${column} stays text: ${outcome.reason}.`);
      } else if (outcome.state === SchemaReconcileState.UNSUPPORTED) {
        return;
      }
    }
  }

  private static readonly ROW_TIMESTAMP_COLUMNS = ['created_at', 'updated_at'] as const;

  async ensureTimestampDefaults(plan: IEntitySchemaPlan): Promise<void> {
    for (const column of DeclaredSchemaReconciler.ROW_TIMESTAMP_COLUMNS) {
      const outcome = await this.db.ensureTimestampDefault(plan.tableName, column);

      if (outcome.state === SchemaReconcileState.CHANGED) {
        this.logger.info(`${plan.tableName}.${column} had no default; it now defaults to the current time.`);
      } else if (outcome.state === SchemaReconcileState.FAILED) {
        this.logger.warn(
          `Could not give ${plan.tableName}.${column} a default: ${outcome.reason}. `
          + 'Rows inserted without a value will go on being stored with no timestamp.'
        );
      } else if (outcome.state === SchemaReconcileState.UNSUPPORTED) {
        return;
      }
    }
  }

  warnUnsupportedIndexes(plan: IEntitySchemaPlan): void {
    if (plan.unsupportedIndexes.length === 0) {
      return;
    }

    this.logger.warn(
      `Collection "${plan.tableName}" declares indexes that are tracked in metadata but not auto-created yet: ` +
      plan.unsupportedIndexes.join(', ')
    );
  }

  /**
   * The fingerprint is a PLATFORM fact, so it is written as the platform's row.
   *
   * One shared schema and one copy of each plugin per platform: a table has exactly one shape, and
   * "is this table in sync" cannot have a different answer per site. But `syncCollection` also runs
   * inside a REQUEST — enabling a plugin from the admin with a site selected — and an unwrapped
   * write there lands the tenant's row, because `_system_meta.tenant_id` defaults to the current
   * tenant. Measured on this deployment: 235 per-tenant duplicates (190 under one site alone)
   * beside 167 platform rows, for facts that describe the same shared schema.
   *
   * The duplicate is not merely untidy. `findOne` on a tenant-bound connection then reads the
   * tenant's copy, so the PLATFORM row stops being updated and goes stale — and the next untenanted
   * boot re-syncs every table it already synced, because the fingerprint it can see no longer
   * matches.
   *
   * `withPlatformAdmin` is also what makes the write legal: the policy admits a tenant-less row only
   * from a connection carrying the platform marker.
   */
  async persistSchemaFingerprint(plan: IEntitySchemaPlan): Promise<void> {
    const metaTableExists = await this.db.tableExists(SystemConstants.TABLE.META);
    if (!metaTableExists) {
      return;
    }

    const key = `entity_schema:${plan.tableName}`;
    const value = JSON.stringify({
      fingerprint: plan.fingerprint,
      updatedAt: new Date().toISOString(),
    });

    await this.db.withPlatformAdmin(async () => {
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
    });
  }
}
