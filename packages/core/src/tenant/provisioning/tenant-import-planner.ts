import fs from 'fs';
import path from 'path';
import type { IDatabaseManager } from '@fromcode119/database';
import { CoercionUtils } from '@core/utils/coercion-utils';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantArchiveReader } from '@core/tenant/provisioning/tenant-archive-reader';
import { TenantIdentity } from '@core/tenant/provisioning/tenant-identity';
import { TenantImportPlan } from '@core/tenant/provisioning/tenant-import-plan';
import { TenantRegistryService } from '@core/tenant/provisioning/tenant-registry-service';
import { TenantSql } from '@core/tenant/provisioning/tenant-sql';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

/**
 * Reads an archive against THIS platform and says what an import would do. Writes nothing.
 *
 * The id decision per table is made here and re-made identically by the executor, from the same
 * inputs: the archive's smallest id and the destination sequence's `last_value`. Preview and
 * execution therefore cannot disagree — unless something wrote to the platform in between, which the
 * executor detects by making the decision again inside its transaction.
 */
export class TenantImportPlanner {
  constructor(
    private readonly db: IDatabaseManager,
    private readonly registry: TenantRegistryService,
    private readonly tables: TenantTableDescriptor[],
    private readonly installed: { plugins: Map<string, string>; themes: Map<string, string> },
    private readonly uploadsDir: string,
  ) {}

  async plan(reader: TenantArchiveReader, identity: TenantIdentity): Promise<TenantImportPlan> {
    const blockers: string[] = [];
    const warnings: string[] = [...reader.manifest.warnings.map((w) => `Export warning: ${w}`)];

    try {
      await this.registry.assertAvailable(identity);
    } catch (error: any) {
      blockers.push(String(error?.message || error));
    }

    const byName = new Map(this.tables.map((table) => [table.name, table]));
    const tables: TenantImportPlan['tables'] = [];
    for (const archived of reader.manifest.tables) {
      const destination = byName.get(archived.name);
      if (!destination) {
        tables.push({ name: archived.name, rows: archived.rows, mode: 'skip', reason: 'This platform has no such tenant table.', opaqueJsonColumns: [], droppedColumns: archived.columns });
        if (archived.rows > 0) warnings.push(`${archived.rows} row(s) of "${archived.name}" will be skipped: the table does not exist here.`);
        continue;
      }
      tables.push(await this.planTable(reader, archived, destination));
    }

    const plugins = reader.manifest.plugins.map((plugin) => ({
      slug: plugin.slug,
      archiveVersion: plugin.version,
      installedVersion: this.installed.plugins.get(plugin.slug) ?? null,
      enabled: this.installed.plugins.has(plugin.slug),
    }));
    for (const plugin of plugins.filter((p) => !p.installedVersion)) {
      warnings.push(`Plugin "${plugin.slug}" (${plugin.archiveVersion}) is not installed here; the site will run without it until it is.`);
    }
    const theme = reader.manifest.theme
      ? { slug: reader.manifest.theme.slug, archiveVersion: reader.manifest.theme.version, installedVersion: this.installed.themes.get(reader.manifest.theme.slug) ?? null }
      : null;
    if (theme && !theme.installedVersion) warnings.push(`Theme "${theme.slug}" is not installed here; the site renders with no theme until one is activated.`);

    const users = await this.planUsers(reader);
    const files = this.planFiles(reader);
    if (files.colliding > 0) warnings.push(`${files.colliding} file name(s) already exist in the uploads directory and will be stored under a suffixed name.`);

    return new TenantImportPlan(reader.manifest, tables, plugins, theme, users, files, blockers, warnings);
  }

  private async planTable(
    reader: TenantArchiveReader,
    archived: { name: string; rows: number; columns: string[]; hasSerialId: boolean },
    destination: TenantTableDescriptor,
  ): Promise<TenantImportPlan['tables'][number]> {
    const droppedColumns = archived.columns.filter((column) => !destination.hasColumn(column));
    // A JSON column the schema declares as a relationship IS followed by the remap; the rest are opaque.
    const followed = new Set(destination.references.map((ref) => ref.column));
    const opaqueJsonColumns = destination.jsonColumns.filter((column) => archived.columns.includes(column) && !followed.has(column));
    if (!destination.hasSerialId || !destination.idSequence) {
      return { name: archived.name, rows: archived.rows, mode: 'preserve', reason: 'No serial id: rows are keyed naturally.', opaqueJsonColumns: [], droppedColumns };
    }
    const decision = await TenantImportPlanner.decideIds(this.db, destination, reader);
    return {
      name: archived.name,
      rows: archived.rows,
      mode: decision.mode,
      reason: decision.reason,
      opaqueJsonColumns: decision.mode === 'remap' ? opaqueJsonColumns : [],
      droppedColumns,
    };
  }

  /** Shared with the executor so the preview and the run decide the same way from the same numbers. */
  static async decideIds(db: IDatabaseManager, table: TenantTableDescriptor, reader: TenantArchiveReader): Promise<{ mode: 'preserve' | 'remap'; reason: string; taken: number; minId: number | null }> {
    const state = (await db.queryRaw(TenantSql.sequenceState(table.idSequence as string)))[0] ?? {};
    const taken = state.is_called === true || state.is_called === 't' ? Number(state.last_value ?? 0) : 0;
    let minId: number | null = null;
    for await (const row of reader.rows(table.name)) {
      const id = Number(row.id);
      if (Number.isFinite(id) && (minId === null || id < minId)) minId = id;
    }
    if (minId === null) return { mode: 'preserve', reason: 'No rows.', taken, minId };
    if (minId > taken) return { mode: 'preserve', reason: `All ids are above the ${taken} this platform has handed out.`, taken, minId };
    return { mode: 'remap', reason: `Ids start at ${minId}, but this platform has handed out ids up to ${taken}; rows get new ids and references are re-pointed.`, taken, minId };
  }

  private async planUsers(reader: TenantArchiveReader): Promise<{ total: number; existing: number; toCreate: number }> {
    let total = 0;
    let existing = 0;
    for await (const user of reader.users()) {
      total += 1;
      const email = CoercionUtils.toKey(user.email);
      if (email && await this.db.findOne(SystemConstants.TABLE.USERS, { email })) existing += 1;
    }
    return { total, existing, toCreate: total - existing };
  }

  private planFiles(reader: TenantArchiveReader): { count: number; bytes: number; colliding: number } {
    const names = reader.fileNames();
    const colliding = names.filter((name) => fs.existsSync(path.join(this.uploadsDir, name))).length;
    return { count: names.length, bytes: reader.manifest.files.bytes, colliding };
  }
}
