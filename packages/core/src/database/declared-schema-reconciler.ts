import type { IEntitySchemaPlan } from '@core/database/interfaces/entity-schema-plan.interface';
import { SystemConstants } from '@core/constants/system.constants';
import type { Logger } from '@core/logging';
import type { IDatabaseManager } from '@fromcode119/database';

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
   * is exactly what mlm did, on the request connection, which is not the table's owner, so it failed
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

      if (outcome.state === 'changed') {
        this.logger.info(`Added the declared UNIQUE on ${plan.tableName}.${column}.`);
      } else if (outcome.state === 'failed') {
        this.logger.warn(
          `Could not add the declared UNIQUE on ${plan.tableName}.${column}: ${outcome.reason}. `
          + 'Existing duplicate values are the usual cause; the constraint stays unenforced until they are resolved.'
        );
      } else if (outcome.state === 'unsupported') {
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

      if (outcome.state === 'changed') {
        this.logger.info(`${plan.tableName}.${column} is optional in the schema; dropped its NOT NULL.`);
      } else if (outcome.state === 'failed') {
        this.logger.warn(
          `Could not relax NOT NULL on ${plan.tableName}.${column}: ${outcome.reason}. `
          + 'Writes that leave it empty will go on being refused until this is resolved.'
        );
      } else if (outcome.state === 'unsupported') {
        // Once per sync, not per column: it is a property of the driver, not of this table.
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
