import type { ICollection } from '@core/collections/interfaces/collection.interface';
import { IDatabaseManager, TenantColumn } from '@fromcode119/database';
import { Logger } from '@core/logging';
import { SystemConstants } from '@core/constants/system.constants';
import { EntitySchemaPlanService } from '@core/database/entity-schema-plan-service';
import { TenantScopedTables } from '@core/database/tenant-scoped-tables';
import { TenantMode } from '@core/tenant/tenant-mode';
import { TenantBespokePolicies } from '@core/database/tenant-bespoke-policies';
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

      // Bring the table under tenant isolation. Runs on every sync, not only on creation, so a
      // table that predates tenancy is scoped the first time it is seen — and the statements are
      // all IF NOT EXISTS / idempotent, so repeating them is free.
      await this.applyTenantIsolation(tableName, { system: collection.system === true });

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

  /**
   * Adds `tenant_id`, its index, ENABLE + FORCE row-level security and the isolation policy.
   *
   * Postgres only — no other supported dialect has row-level security, and pretending otherwise
   * would be worse than not claiming it. `CREATE POLICY` has no IF NOT EXISTS, so an existing policy
   * surfaces as a duplicate-object error and is the one case treated as success.
   */
  /**
   * Brings EVERY existing tenant-scoped table under isolation, not just the ones synced this boot.
   *
   * `syncCollection` only runs for collections that are actually registered, so a table belonging to
   * a disabled plugin — or one created before tenancy existed — would otherwise stay unscoped and
   * readable by every tenant, with nothing to indicate it. The statements are idempotent, so this is
   * safe to run on every boot.
   */
  async applyTenantIsolationSweep(systemTables: Set<string>): Promise<void> {
    // The capability, ASKED of the driver — not a string compare against its name. Row-level
    // security is the Postgres driver's to own, and a caller that hard-codes the dialect goes stale
    // the moment another driver gains isolation.
    if (!this.db.supportsTenantIsolation()) return;

    // No tenants means nothing to isolate — and a policy left standing here empties the whole site
    // (see `applyTenantIsolation`). Repair rather than skip: an installation that ran an earlier
    // build of this sweep is sitting on policies right now.
    if (!TenantMode.isEnabled()) {
      await this.removeTenantIsolation();
      return;
    }

    const tables = await this.db.getTables();
    for (const table of tables ?? []) {
      const name = String(table);
      await this.applyTenantIsolation(name, { system: systemTables.has(name.toLowerCase()) });
    }

    await this.applyBespokeTenantPolicies();

    // Framework tables whose policy comes from a migration (`people`, `person_catalogs`, the bespoke
    // three) never pass through `applyTenantIsolation`, so their unique rules are scoped here — every
    // table that carries a tenant policy, whichever path gave it one.
    const policed = await this.db.tenantIsolation.listPolicies();
    for (const table of new Set(policed.map((entry) => entry.table))) {
      await this.scopeUniqueConstraints(table);
    }
  }

  /**
   * Re-applies the policies the generic sweep cannot express (media sharing, settings).
   *
   * They were introduced by migrations, and migrations run once — so a deployment whose policies
   * were removed while it had no tenants would come back UNPROTECTED on those three tables the day
   * it gained one. Applying them from the sweep makes both directions self-healing.
   */
  private async applyBespokeTenantPolicies(): Promise<void> {
    for (const spec of TenantBespokePolicies.specs()) {
      await this.db.tenantIsolation.applyPolicy(spec).catch((error: any) => {
        if (SchemaManager.isDuplicateObject(error)) return;
        this.logger.warn(`Bespoke tenant policy for "${spec.table}" failed: ${error?.message || error}`);
      });
    }
  }

  /**
   * Takes a tenant-less deployment back out of tenant isolation.
   *
   * Loud on purpose. Removing row-level security is exactly the kind of thing that must never happen
   * quietly — but the condition is unambiguous (`_system_tenants` is empty, so there is no second
   * customer to protect anyone from), and the alternative is an installation whose site is blank and
   * whose admin cannot save anything. The `tenant_id` columns are kept, so nothing is lost and the
   * next boot with a tenant re-applies the policies.
   */
  private async removeTenantIsolation(): Promise<void> {
    const byTable = new Map<string, string[]>();
    for (const { table, policy } of await this.db.tenantIsolation.listPolicies()) {
      byTable.set(table, [...(byTable.get(table) ?? []), policy]);
    }
    if (byTable.size === 0) return;

    this.logger.warn(
      `Deployment has NO tenants, but ${byTable.size} table(s) still carry tenant isolation. `
      + 'On a tenant-less deployment no tenant is bound to the connection, so those policies match '
      + 'no row: the site reads empty and writes are refused. Removing them (tenant_id columns are '
      + `kept): ${[...byTable.keys()].join(', ')}`,
    );

    for (const [table, policies] of byTable) {
      await this.db.tenantIsolation.releaseTable(table, policies).catch((error: any) => {
        this.logger.warn(`Could not remove tenant isolation from "${table}": ${error?.message || error}`);
      });
    }
  }

  /**
   * Reports every tenant-scoped table holding rows that predate tenancy.
   *
   * `tenant_id` is added NULLABLE so the DDL can be applied to a populated table (a NOT NULL column
   * whose default evaluates to NULL cannot be). Those rows are then invisible to EVERY tenant —
   * fail-closed, which is right, but silent. Data that has become unreachable must be said out loud
   * so an operator can assign it an owner instead of discovering it missing.
   *
   * Must run BEFORE `ENABLE ROW LEVEL SECURITY` for this table — see the call site.
   */
  private async warnAboutUnassignedRows(tableName: string): Promise<void> {
    try {
      const unassigned = await this.db.tenantIsolation.countUnassigned(tableName);
      if (unassigned === 0) return;
      this.logger.warn(
        `${tableName}: ${unassigned} row(s) predate tenancy and have no ${TenantColumn.NAME}, so they `
        + 'will be invisible to every tenant. Assign them an owner or delete them — they are not lost, '
        + 'but nothing can read them.',
      );
    } catch {
      // Diagnostic only; never let counting break a boot.
    }
  }

  /**
   * A UNIQUE rule written for one site must hold PER site once the table is shared.
   *
   * `fcp_cms_pages.slug UNIQUE` meant "one /about per site"; on a shared table it means one /about
   * across every customer — the second tenant is refused, and importing a whole site collides on its
   * first category. Found through the import (T4), it is a T0 gap: every such constraint and
   * stand-alone unique index becomes `(cols…, tenant_id)`. Discovered from the catalog each boot, so a
   * new plugin table is covered the moment it exists; already-scoped rules are not touched again.
   * Uniques a FOREIGN KEY depends on are left alone and named in the log.
   */
  private async scopeUniqueConstraints(tableName: string): Promise<void> {
    const scoped = await this.db.tenantIsolation.scopeUniqueRules(tableName);
    for (const rule of scoped.constraints) {
      this.logger.info(`${tableName}: UNIQUE "${rule.name}" (${rule.columns.join(', ')}) is scoped per tenant.`);
    }
    for (const rule of scoped.indexes) {
      this.logger.info(`${tableName}: UNIQUE INDEX "${rule.name}" (${rule.columns.join(', ')}) is scoped per tenant.`);
    }
  }

  /** Walks the driver's wrapper chain looking for Postgres' duplicate_object code. */
  private static isDuplicateObject(error: any): boolean {
    for (let current = error; current; current = current.cause) {
      if (current.code === '42710') return true;
    }
    return false;
  }

  /**
   * NOTHING IS SCOPED ON A DEPLOYMENT THAT HAS NO TENANTS, and that is the difference between a
   * working installation and an empty one.
   *
   * The policy is `tenant_id = nullif(current_setting('app.tenant_id', true), '')`. A single-tenant
   * deployment never binds a tenant to the connection — there is none to bind — so on the request
   * role (`fromcode_app`, non-owner, under FORCE RLS) that predicate is NULL for every row. Proven
   * against Postgres 15 on an isolated table carrying one pre-existing row:
   *
   *     SELECT count(*) FROM probe;   -- 0 of 1
   *     INSERT INTO probe (title) ...  -- ERROR: new row violates row-level security policy
   *
   * So applying this unconditionally does not merely hide old rows: it empties every page, product
   * and order on the site AND makes creating new ones impossible. The earlier single-tenant check
   * missed it because it ran against a FRESH database, where "no rows" and "all rows hidden" are the
   * same observation.
   *
   * A policy that has to be bypassed on every request is worse than no policy, so a deployment with
   * no tenants gets no policy. Adding the first tenant already requires a restart (see `TenantMode`),
   * and that restart is what runs this sweep for real.
   */
  private async applyTenantIsolation(tableName: string, options: { system?: boolean } = {}): Promise<void> {
    if (!this.db.supportsTenantIsolation()) return;
    if (!TenantMode.isEnabled()) return;
    if (!TenantScopedTables.isTenantScoped(tableName, options)) return;

    try {
      // The column FIRST, then the diagnostics, then enforcement — and the order is load-bearing.
      // FORCE RLS applies to the table OWNER too, so once it is on even this connection cannot see
      // rows with a NULL tenant_id: counting afterwards would report zero for exactly the tables
      // that need reporting. This used to be expressed by looking for 'ENABLE ROW LEVEL SECURITY'
      // inside the statement strings, which only worked while the caller could read the SQL.
      await this.db.tenantIsolation.addTenantColumn(tableName);
      await this.warnAboutUnassignedRows(tableName);
      await this.scopeUniqueConstraints(tableName);
      await this.db.tenantIsolation.enforceIsolation(tableName);
    } catch (error: any) {  // eslint-disable-line @typescript-eslint/no-explicit-any
      // 42710 = duplicate_object. The statements drop the policy first so this should not happen,
      // but the driver wraps the pg error, so the code is checked down the cause chain rather than
      // only on the surface object.
      if (SchemaManager.isDuplicateObject(error)) return;
      this.logger.error(`Failed to apply tenant isolation to ${tableName}: ${error}`);
      throw error;
    }
  }

  private async updateTable(plan: IEntitySchemaPlan): Promise<void> {
    for (const column of plan.missingColumns) {
      this.logger.info(`Adding column ${column.columnName} to ${plan.tableName}...`);
      await this.db.addColumn(plan.tableName, SchemaManager.toSchemaField(column.field));
    }

    await this.ensureDeclaredUniques(plan);
    await this.relaxDeclaredOptionals(plan);
  }

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
  private async ensureDeclaredUniques(plan: IEntitySchemaPlan): Promise<void> {
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
  private async relaxDeclaredOptionals(plan: IEntitySchemaPlan): Promise<void> {
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
