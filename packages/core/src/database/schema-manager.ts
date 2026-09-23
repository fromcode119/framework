import type { ICollection } from '@core/collections/interfaces/collection.interface';
import { IDatabaseManager, TenantColumn } from '@fromcode119/database';
import { Logger } from '@core/logging';
import { SystemConstants } from '@core/constants/system.constants';
import { EntitySchemaPlanService } from '@core/database/entity-schema-plan-service';
import { SchemaReconciliationService } from '@core/database/schema-reconciliation-service';
import type { IEntitySchemaPlan } from '@core/database/interfaces/entity-schema-plan.interface';
import type { IField } from '@core/interfaces/field.interface';
import { SchemaTenantIsolationService } from '@core/database/schema-tenant-isolation-service';
import { DeclaredSchemaReconciler } from '@core/database/declared-schema-reconciler';

export class SchemaManager {
  private logger = new Logger({ namespace: 'schema-manager' });
  private entitySchemaPlan = new EntitySchemaPlanService();
  private readonly reconciliation: SchemaReconciliationService;

  private readonly tenantIsolation: SchemaTenantIsolationService;
  private readonly declared: DeclaredSchemaReconciler;

  constructor(private db: IDatabaseManager) {
    this.reconciliation = new SchemaReconciliationService(db);
    this.tenantIsolation = new SchemaTenantIsolationService(db, this.logger);
    this.declared = new DeclaredSchemaReconciler(db, this.logger);
  }

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
      await this.tenantIsolation.applyTenantIsolation(tableName, { system: collection.system === true });

      this.declared.warnUnsupportedIndexes(plan);
      await this.declared.persistSchemaFingerprint(plan);
    } catch (error) {
      this.logger.error(`Failed to sync schema for ${tableName}: ${error}`);
      throw error;
    }
  }

  /**
   * Record what the database has that NOTHING declares — once, after every plugin has registered.
   *
   * NOT during `syncCollection`, and that is the whole correctness of it. A collection is extended by
   * OTHER plugins after its own table syncs: a metadata plugin injects `ogTitle`, `canonicalUrl`,
   * `focusKeyword` and three more into a content plugin's pages and posts from its `onInit`, and a shop
   * plugin registers `licenseProduct` onto products at runtime. Judged at sync time, all of those look
   * undeclared — measured: 13 of 19 findings were fields a later plugin declares, including one read
   * on every order. Proposing those for removal is precisely the harm this feature exists to prevent,
   * so the question is only asked once the full picture exists.
   */
  async recordUndeclaredColumns(
    entries: Array<{ collection: ICollection; pluginSlug: string }>,
    inactivePlugins: string[] = [],
    absentPluginTables: string[] = [],
  ): Promise<void> {
    // THE DECLARED PICTURE MAY BE INCOMPLETE, and the finding must say so rather than pretend.
    //
    // `licenseProduct` on products is declared only while the licence-issuing plugin is ACTIVE; with it
    // disabled the column looks undeclared while still holding every licence issued when it ran.
    // Refusing to audit at all while any plugin is inactive was the first answer and it is worse:
    // measured on this deployment, 12 of 19 installed plugins are inactive, so the audit would never
    // once have run. A queue that never runs is the report that was already rejected.
    //
    // So the caveat travels WITH each finding to the operator who approves it. Nothing is ever
    // dropped automatically, and the one judgement a human is uniquely able to make — "that column
    // belongs to the plugin I turned off last month" — is exactly the judgement this hands them.
    if (inactivePlugins.length > 0) {
      this.logger.info(
        `Undeclared-column audit: ${inactivePlugins.length} installed plugin(s) are not active `
        + `(${inactivePlugins.join(', ')}). A column one of them declares will look like an orphan, `
        + 'so each finding is marked accordingly.',
      );
    }

    const failed = new Set<string>();
    const found = new Set<string>();

    for (const { collection, pluginSlug } of entries) {
      // FRAMEWORK TABLES ARE NOT JUDGED THIS WAY, and the two that proved it are `media.shared` —
      // the column the media sharing POLICY itself reads — and `users.is_platform_admin`, which
      // decides who is a platform administrator. Both were proposed for removal, and both are live.
      //
      // The cause is structural, not a missed case: a framework table's columns come from
      // MIGRATIONS, so the collection's field list was never the full declaration and the diff
      // against it is meaningless. Plugin tables are the opposite — their shape IS the declaration,
      // which is exactly why plugin updates leave this debt and framework migrations do not.
      //
      // Still marked audited, so anything wrongly recorded by an earlier build is pruned rather than
      // left sitting in the queue waiting to be approved.
      if (pluginSlug === 'system' || collection.system === true) continue;

      try {
        const plan = await this.planCollection(collection);
        if (!plan.exists) continue;
        await this.reconciliation.record(plan, inactivePlugins);
        for (const column of plan.undeclaredColumns) found.add(`${plan.tableName}.${column}`);
      } catch (error: any) {  // eslint-disable-line @typescript-eslint/no-explicit-any
        // Only a FAILED audit protects its entries from pruning: no fresh answer is not the same as
        // "no longer a finding".
        failed.add(collection.slug);
        this.logger.warn(`Could not audit ${collection.slug}: ${error?.message || error}`);
      }
    }

    // A plugin that is not RUNNING registers no collections, so its tables produce no findings and
    // would be pruned as though the debt were resolved — losing `firstSeenAt` and the caveat history
    // on an unrelated toggle. Not-running is "no fresh answer", which is exactly what prune must
    // leave alone.
    for (const table of absentPluginTables) failed.add(table);

    await this.reconciliation.prune(failed, found);
  }

  /** Every table in the schema — for finding ones whose plugin is not currently running. */
  async listTables(): Promise<string[]> {
    return (await this.db.getTables()) ?? [];
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
  /** @see SchemaTenantIsolationService.applyTenantIsolationSweep */
  async applyTenantIsolationSweep(systemTables: Set<string>): Promise<void> {
    return this.tenantIsolation.applyTenantIsolationSweep(systemTables);
  }

  private async updateTable(plan: IEntitySchemaPlan): Promise<void> {
    for (const column of plan.missingColumns) {
      this.logger.info(`Adding column ${column.columnName} to ${plan.tableName}...`);
      await this.db.addColumn(plan.tableName, SchemaManager.toSchemaField(column.field));
    }

    await this.declared.ensureDeclaredUniques(plan);
    await this.declared.relaxDeclaredOptionals(plan);
    await this.declared.convertTextPointInTimeColumns(plan);
    await this.declared.ensureTimestampDefaults(plan);
  }

}
