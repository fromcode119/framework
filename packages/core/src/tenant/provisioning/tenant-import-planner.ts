import { TenantImportIdMode } from '@core/tenant/provisioning/enums/tenant-import-id-mode.enum';
import fs from 'fs';
import path from 'path';
import type { IDatabaseManager } from '@fromcode119/database';
import { PhysicalTableNameUtils } from '@fromcode119/database';
import { CoercionUtils } from '@core/utils/coercion-utils';
import { SystemConstants } from '@core/constants/system.constants';
import { SecretService } from '@core/security/secret-service';
import { SecretTransitResealer } from '@core/security/secret-transit-resealer';
import { TenantBespokePolicies } from '@core/database/tenant-bespoke-policies';
import { TenantArchiveReader } from '@core/tenant/provisioning/tenant-archive-reader';
import { TenantIdentity } from '@core/tenant/provisioning/tenant-identity';
import { TenantImportPlan } from '@core/tenant/provisioning/tenant-import-plan';
import { TenantInstalledPluginSlugs } from '@core/tenant/provisioning/tenant-installed-plugin-slugs';
import { TenantOwningPluginResolver } from '@core/tenant/provisioning/tenant-owning-plugin-resolver';
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
    const warnings: string[] = [];
    // Written into the archive when it was exported — what it holds, not what THIS import decides.
    // Kept apart from `warnings` (below) rather than merged in with an `Export warning:` prefix, so an
    // operator reading the decisions this import makes never has to sort a live one from a stale note.
    const exportWarnings: string[] = [...reader.manifest.warnings];

    try {
      await this.registry.assertAvailable(identity);
    } catch (error: any) {
      blockers.push(String(error?.message || error));
    }

    // The archive's own plugins are the REAL slugs to check a skipped table's physical name
    // against — `PhysicalTableNameUtils.parse` splits at the first underscore, which is wrong for a
    // multi-token slug (`alpha-beta` truncates to `alpha`). With no plugins named at all
    // (an archive written before that field existed) there is nothing real to check against, so the
    // naive split remains the best available guess rather than nothing.
    const knownPluginSlugs = reader.manifest.plugins.map((plugin) => plugin.slug);

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
          // No destination descriptor exists for a skipped table, so there is no collection to ask —
          // but the physical name itself (`fcp_<slug>_...`) still says which plugin would have owned
          // it, which is exactly what "install and enable the plugin that owns it" (below) needs said.
          pluginSlug: knownPluginSlugs.length > 0
            ? TenantOwningPluginResolver.resolve(archived.name, knownPluginSlugs)
            : (PhysicalTableNameUtils.parse(archived.name)?.pluginSlug ?? null),
          label: null,
          isJournal: false,
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
    const secretsArrive = await this.warnUnreadableSecrets(reader, warnings);

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

    // Two more classes of row the EXECUTOR drops at run time (`TenantImportExecutor.rowFilter`)
    // that the id-mode/column accounting above never sees, because the table itself is still
    // imported — only some of its rows are not. Both are knowable now, from the same inputs the
    // executor uses, so the preview's "left behind" summary can count them rather than miss them.
    const platformKeys = new Set(TenantBespokePolicies.platformKeys());
    const metaRowsExcluded = await TenantImportPlanner.countExcludedRows(
      reader, tables, SystemConstants.TABLE.META, (row) => platformKeys.has(String(row.key ?? '')),
    );
    // The executor's own rowFilter checks `_system_plugins` directly (`TenantInstalledPluginSlugs`),
    // never the plugin host's in-memory loaded set — a plugin whose row exists but failed to load
    // (or was installed by another process since this one booted) is still "installed" for that
    // filter, so the preview must read the same table or it could count rows the executor would
    // actually keep.
    const installedPluginSlugs = await TenantInstalledPluginSlugs.read(this.db);
    const pluginSettingsRowsExcluded = await TenantImportPlanner.countExcludedRows(
      reader, tables, SystemConstants.TABLE.PLUGIN_SETTINGS, (row) => !installedPluginSlugs.has(String(row.plugin_slug ?? '')),
    );

    return new TenantImportPlan(
      reader.manifest, tables, plugins, theme, users, files, blockers, warnings, exportWarnings,
      metaRowsExcluded, pluginSettingsRowsExcluded, secretsArrive,
    );
  }

  /** How many rows of `tableName` the executor's own row filter would drop — 0 when the table is skipped or empty. */
  private static async countExcludedRows(
    reader: TenantArchiveReader,
    tables: TenantImportPlan['tables'],
    tableName: string,
    excluded: (row: Record<string, unknown>) => boolean,
  ): Promise<number> {
    const table = tables.find((entry) => entry.name === tableName);
    if (!table || table.mode === String(TenantImportIdMode.SKIP.value) || table.rows === 0) return 0;
    let count = 0;
    for await (const row of reader.rows(tableName)) {
      if (excluded(row)) count += 1;
    }
    return count;
  }

  private async planTable(
    reader: TenantArchiveReader,
    archived: { name: string; rows: number; columns: string[]; hasSerialId: boolean },
    destination: TenantTableDescriptor,
  ): Promise<TenantImportPlan['tables'][number]> {
    // A column this platform no longer has is dropped, and the operator is told which.
    const droppedColumns = archived.columns.filter((column) => !destination.hasColumn(column));
    // A JSON column the schema declares as a relationship IS followed by the remap; the rest are opaque.
    const followed = new Set(destination.references.map((ref) => ref.column));
    const opaqueJsonColumns = destination.jsonColumns.filter((column) => archived.columns.includes(column) && !followed.has(column));
    const repointedReferences = destination.references
      .filter((ref) => archived.columns.includes(ref.column))
      // A polymorphic reference has no one target to name, so it names the column that names one —
      // the preview then says what will be followed rather than showing an empty arrow.
      .map((ref) => ({ column: ref.column, path: ref.path, targetTable: ref.describeTarget() }));
    if (!destination.hasSerialId || !destination.idSequence) {
      return {
        name: archived.name, rows: archived.rows, mode: String(TenantImportIdMode.PRESERVE.value), basis: 'naturalKey',
        minId: null, taken: null, opaqueJsonColumns: [], repointedReferences: [], droppedColumns,
        pluginSlug: destination.pluginSlug, label: destination.label, isJournal: destination.isJournal,
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
      pluginSlug: destination.pluginSlug,
      label: destination.label,
      isJournal: destination.isJournal,
    };
  }

  /**
   * A secret in the archive was encrypted by the deployment that EXPORTED it, and every deployment
   * holds its own key — so it arrives intact and still unreadable here. Saying so is the difference
   * between an operator who re-enters one password and one who spends days on a courier that
   * answers "no cities" because its username resolved to nothing.
   */
  private async warnUnreadableSecrets(reader: TenantArchiveReader, warnings: string[]): Promise<boolean> {
    let rows = 0;
    let readable = true;
    for await (const row of reader.rows(SystemConstants.TABLE.META)) {
      if (!SecretService.carriesEncryptedValue(row.value)) continue;
      rows += 1;
      // Asked, not assumed. An archive exported and re-imported on the same platform shares a key,
      // and its secrets open here perfectly well — telling that operator to re-enter every password
      // is worse than saying nothing.
      if (readable && !SecretTransitResealer.readableHere(row.value)) readable = false;
    }
    if (rows === 0) return true;
    if (reader.manifest.secretsSealed) {
      warnings.push(
        `${rows} setting row(s) carry a secret. This archive was sealed for transit, so they are `
        + 'taken into this deployment\'s own key during the import and each integration works as soon '
        + 'as it finishes — provided the import is given the same passphrase the export used.',
      );
      return true;
    }
    if (readable) {
      warnings.push(
        `${rows} setting row(s) carry a secret. This deployment's own key opens them, so each `
        + 'integration arrives configured and working.',
      );
      return true;
    }
    warnings.push(
      `${rows} setting row(s) carry a secret encrypted by the deployment that exported them. `
      + 'They are imported as they are, but this deployment has its own key and cannot read them, '
      + 'so each affected integration stays unconfigured until its secret is set again here.',
    );
    return false;
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
