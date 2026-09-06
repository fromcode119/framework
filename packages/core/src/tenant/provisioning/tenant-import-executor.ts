import type { IDatabaseManager } from '@fromcode119/database';
import { Logger } from '@core/logging';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantBespokePolicies } from '@core/database/tenant-bespoke-policies';
import { TenantMembershipService } from '@core/tenant/tenant-membership-service';
import { TenantRecord } from '@core/tenant/tenant-record';
import { PluginTenantStateService } from '@core/plugin/tenant/plugin-tenant-state-service';
import { TenantThemeStateService } from '@core/theme/tenant-theme-state-service';
import { TenantArchiveReader } from '@core/tenant/provisioning/tenant-archive-reader';
import { TenantIdRemap } from '@core/tenant/provisioning/tenant-id-remap';
import { TenantIdentity } from '@core/tenant/provisioning/tenant-identity';
import { TenantImportFiles } from '@core/tenant/provisioning/tenant-import-files';
import { TenantImportPlan } from '@core/tenant/provisioning/tenant-import-plan';
import { TenantImportPlanner } from '@core/tenant/provisioning/tenant-import-planner';
import { TenantImportResult } from '@core/tenant/provisioning/tenant-import-result';
import { TenantImportUsers } from '@core/tenant/provisioning/tenant-import-users';
import { TenantRegistryService } from '@core/tenant/provisioning/tenant-registry-service';
import { TenantRowInserter } from '@core/tenant/provisioning/tenant-row-inserter';
import { TenantSql } from '@core/tenant/provisioning/tenant-sql';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

/**
 * Runs an import plan.
 *
 * Order: tenant row → (in one transaction on the OWNER connection, scoped to the new tenant so
 * row-level security both applies and passes) users → files → tables in dependency order → sequences
 * → (outside the transaction, not RLS'd) memberships, plugin enablement, theme activation. A failure
 * anywhere in the transaction rolls every row back and removes the tenant row again: an import
 * either produced a whole site or nothing.
 *
 * The id decision is re-made here rather than trusted from the plan: the plan is what the operator
 * saw, but the sequence may have moved since.
 */
export class TenantImportExecutor {
  private readonly logger = new Logger({ namespace: 'tenant-import' });

  constructor(
    private readonly db: IDatabaseManager,
    private readonly registry: TenantRegistryService,
    private readonly tables: TenantTableDescriptor[],
    private readonly uploadsDir: string,
  ) {}

  async execute(reader: TenantArchiveReader, identity: TenantIdentity, plan: TenantImportPlan): Promise<TenantImportResult> {
    if (!plan.canExecute) throw new Error(`Import refused: ${plan.blockers.join(' ')}`);
    const tenant = await this.registry.create(identity);
    const warnings = [...plan.warnings];
    const remap = new TenantIdRemap();
    const inserted: Record<string, number> = {};

    try {
      await this.db.withTenant(tenant.id, async () => {
        await this.db.queryRaw('BEGIN');
        try {
          await new TenantImportUsers(this.db).run(reader, remap, warnings);
          const files = new TenantImportFiles(this.uploadsDir).run(reader, tenant.id, warnings);
          const installedPlugins = await this.installedPluginSlugs();
          for (const table of this.tables) {
            if (!reader.manifest.tableNames.includes(table.name)) continue;
            inserted[table.name] = await this.importTable(reader, table, tenant, remap, files, installedPlugins, warnings);
          }
          await this.db.queryRaw('COMMIT');
        } catch (error) {
          await this.db.queryRaw('ROLLBACK').catch(() => undefined);
          throw error;
        }
      });
    } catch (error) {
      this.logger.error(`Import of "${identity.slug}" failed; removing the tenant row again.`, error);
      await this.registry.remove(tenant.id).catch(() => undefined);
      throw error;
    }

    const members = await this.grantMemberships(reader, tenant, remap);
    const plugins = await this.enablePlugins(plan, tenant);
    const theme = await this.activateTheme(plan, reader, tenant);
    // `users` is always in the remap (accounts are matched by email, never by id), but that is not a
    // re-numbering the operator needs to hear about — only content tables are listed.
    const renumbered = remap.remappedTables.filter((table) => table !== SystemConstants.TABLE.USERS);
    return new TenantImportResult(tenant, inserted, renumbered, members, plugins, theme, warnings);
  }

  private async importTable(
    reader: TenantArchiveReader,
    table: TenantTableDescriptor,
    tenant: TenantRecord,
    remap: TenantIdRemap,
    files: TenantImportFiles,
    installedPlugins: Set<string>,
    warnings: string[],
  ): Promise<number> {
    const inserter = new TenantRowInserter(this.db, table, tenant.id, remap, files, warnings);
    if (table.hasSerialId && table.idSequence) {
      const decision = await TenantImportPlanner.decideIds(this.db, table, reader);
      if (decision.mode === 'remap') await this.allocateIds(reader, table, remap);
    }
    const skipRow = TenantImportExecutor.rowFilter(table, installedPlugins);
    let count = 0;
    let skipped = 0;
    let maxId = 0;
    for await (const row of reader.rows(table.name)) {
      if (skipRow(row)) {
        skipped += 1;
        continue;
      }
      const newId = await inserter.insert(row);
      if (typeof newId === 'number' && newId > maxId) maxId = newId;
      count += 1;
    }
    await inserter.finishSelfReferences();
    if (table.idSequence && maxId > 0) await this.db.queryRaw(TenantSql.advanceSequence(table.idSequence), [maxId]);
    if (skipped > 0) warnings.push(`${skipped} row(s) of "${table.name}" were not imported: platform-level settings, or settings of a plugin this platform does not have.`);
    return count;
  }

  private async allocateIds(reader: TenantArchiveReader, table: TenantTableDescriptor, remap: TenantIdRemap): Promise<void> {
    const oldIds: unknown[] = [];
    for await (const row of reader.rows(table.name)) oldIds.push(row.id);
    if (oldIds.length === 0) return;
    const fresh = await this.db.queryRaw(TenantSql.allocateIds(table.idSequence as string), [oldIds.length]);
    fresh.forEach((row, index) => remap.set(table.name, oldIds[index], Number(row.id)));
    remap.markRemapped(table.name);
  }

  /**
   * Rows an import must NOT carry across: platform-level settings (deployment truths a tenant cannot
   * own) and settings of plugins this platform does not have (their FK would fail, and nothing would
   * read them).
   */
  private static rowFilter(table: TenantTableDescriptor, installedPlugins: Set<string>): (row: Record<string, unknown>) => boolean {
    if (table.name === SystemConstants.TABLE.META) {
      const platform = new Set(TenantBespokePolicies.platformKeys());
      return (row) => platform.has(String(row.key ?? ''));
    }
    if (table.name === SystemConstants.TABLE.PLUGIN_SETTINGS) {
      return (row) => !installedPlugins.has(String(row.plugin_slug ?? ''));
    }
    return () => false;
  }

  private async installedPluginSlugs(): Promise<Set<string>> {
    const rows = await this.db.queryRaw(`SELECT slug FROM ${TenantSql.identifier(SystemConstants.TABLE.PLUGINS)}`);
    return new Set(rows.map((row) => String(row.slug)));
  }

  private async grantMemberships(reader: TenantArchiveReader, tenant: TenantRecord, remap: TenantIdRemap): Promise<number> {
    const memberships = new TenantMembershipService(this.db);
    let count = 0;
    for await (const user of reader.users()) {
      const userId = remap.resolve(SystemConstants.TABLE.USERS, user.id);
      if (userId === null || userId === undefined || userId === '') continue;
      const roles = Array.isArray(user.roles) ? user.roles.map((role) => String(role)) : [];
      await memberships.grant(String(userId), tenant.id, roles);
      count += 1;
    }
    return count;
  }

  private async enablePlugins(plan: TenantImportPlan, tenant: TenantRecord): Promise<string[]> {
    const service = new PluginTenantStateService(this.db);
    const enabled: string[] = [];
    for (const plugin of plan.plugins.filter((p) => p.enabled)) {
      await service.enable(tenant.id, plugin.slug);
      enabled.push(plugin.slug);
    }
    return enabled;
  }

  private async activateTheme(plan: TenantImportPlan, reader: TenantArchiveReader, tenant: TenantRecord): Promise<string | null> {
    if (!plan.theme || !plan.theme.installedVersion) return null;
    const service = new TenantThemeStateService(this.db);
    await service.activate(tenant.id, plan.theme.slug);
    const config = reader.manifest.theme?.config;
    if (config && typeof config === 'object') await service.saveConfig(tenant.id, plan.theme.slug, config);
    return plan.theme.slug;
  }
}
