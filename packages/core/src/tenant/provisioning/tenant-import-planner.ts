import { TenantImportIdMode } from '@core/tenant/provisioning/enums/tenant-import-id-mode.enum';
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
    // False only for a catalog built with no collections at all (a CLI process runs no plugin host).
    // Without it every `schema` reference is invisible, so a remap-mode table's JSON columns look
    // "opaque" for a reason the operator cannot fix by reading the preview — they need the admin's
    // import path, or an archive whose ids need no remap. `plan()` refuses rather than say nothing.
    private readonly hasSchemaReferences: boolean = true,
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
        // `droppedColumns` means "columns this platform's table does not have". With no table at all
        // the honest answer is "not applicable", not "all of them": listing every column invited the
        // preview to print 25 names for a table whose only possible action is "install the plugin".
        // The rows that are lost are counted in `warnings` below, which is where that fact belongs.
        tables.push({
          name: archived.name, rows: archived.rows, mode: String(TenantImportIdMode.SKIP.value), basis: 'noTable',
          minId: null, taken: null, opaqueJsonColumns: [], repointedReferences: [], droppedColumns: [],
        });
        if (archived.rows > 0) {
          warnings.push(
            `${archived.rows} row(s) of "${archived.name}" will be skipped: no such table here. `
            + 'Install and enable the plugin that owns it, then import again, to keep them.',
          );
        }
        continue;
      }
      tables.push(await this.planTable(reader, archived, destination));
    }

    // With no collections at all, a `schema` reference can never be found (see the constructor note)
    // — so a table that WILL be re-numbered and carries JSON is exactly the vselenskiportal88 defect
    // waiting to happen again, silently, and the preview would have no way to say so either. Refusing
    // beats guessing which JSON columns would have been fine to leave opaque.
    if (!this.hasSchemaReferences) {
      const risky = tables.filter((table) => table.mode === String(TenantImportIdMode.REMAP.value) && table.opaqueJsonColumns.length > 0);
      if (risky.length > 0) {
        blockers.push(
          `No collection schema was available to this import (this process runs no plugin host), and `
          + `${risky.map((table) => table.name).join(', ')} would be re-numbered with JSON columns whose ids `
          + 'could not be re-pointed. Import through Sites → Import in the admin, or import an archive whose ids need no remap.',
        );
      }
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
    // What it MEANS for the operator's files, not what the importer will do to them. The old wording
    // named the mechanism ("stored under a suffixed name") and left the only question that matters
    // unanswered: is something of mine about to be overwritten. Nothing is.
    if (files.colliding > 0) {
      warnings.push(
        `${files.colliding} of the archive's files have names that are already in the uploads directory. `
        + `Nothing is overwritten — the files already there are left exactly as they are, and the archive's `
        + `copies are saved alongside them under a suffixed name.`,
      );
    }

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
    const repointedReferences = destination.references
      .filter((ref) => archived.columns.includes(ref.column))
      .map((ref) => ({ column: ref.column, path: ref.path, targetTable: ref.targetTable }));
    if (!destination.hasSerialId || !destination.idSequence) {
      return {
        name: archived.name, rows: archived.rows, mode: String(TenantImportIdMode.PRESERVE.value), basis: 'naturalKey',
        minId: null, taken: null, opaqueJsonColumns: [], repointedReferences: [], droppedColumns,
      };
    }
    const decision = await TenantImportPlanner.decideIds(this.db, destination, reader);
    return {
      name: archived.name,
      rows: archived.rows,
      mode: String(decision.mode.value),
      basis: decision.basis,
      minId: decision.minId,
      taken: decision.taken,
      opaqueJsonColumns: decision.mode === TenantImportIdMode.REMAP ? opaqueJsonColumns : [],
      repointedReferences: decision.mode === TenantImportIdMode.REMAP ? repointedReferences : [],
      droppedColumns,
    };
  }

  /** Shared with the executor so the preview and the run decide the same way from the same numbers. */
  static async decideIds(db: IDatabaseManager, table: TenantTableDescriptor, reader: TenantArchiveReader): Promise<{ mode: TenantImportIdMode; basis: 'empty' | 'aboveSequence' | 'belowSequence'; taken: number; minId: number | null }> {
    const state = (await db.queryRaw(TenantSql.sequenceState(table.idSequence as string)))[0] ?? {};
    const taken = state.is_called === true || state.is_called === 't' ? Number(state.last_value ?? 0) : 0;
    let minId: number | null = null;
    for await (const row of reader.rows(table.name)) {
      const id = Number(row.id);
      if (Number.isFinite(id) && (minId === null || id < minId)) minId = id;
    }
    if (minId === null) return { mode: TenantImportIdMode.PRESERVE, basis: 'empty', taken, minId };
    if (minId > taken) return { mode: TenantImportIdMode.PRESERVE, basis: 'aboveSequence', taken, minId };
    return { mode: TenantImportIdMode.REMAP, basis: 'belowSequence', taken, minId };
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
