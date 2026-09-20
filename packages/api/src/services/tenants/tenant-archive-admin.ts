import fs from 'fs';
import path from 'path';
import { TenantAdminState } from '@api/services/tenants/tenant-admin-state';
import { TenantMembersService } from '@api/services/tenants/tenant-members-service';
import { TenantPagesService } from '@api/services/tenants/tenant-pages-service';
import { TenantSummary } from '@api/services/tenants/tenant-summary';
import { AuditOutcome, BackupService, CoercionUtils, PluginState, PluginTenantStateService, SystemConstants, TenantAdoptionService, TenantArchiveLayout, TenantArchiveManifest, TenantArchiveReader, TenantArchiveSource, TenantArchiveWriter, TenantColumnPreparer, TenantEraser, TenantIdentity, TenantImportExecutor, TenantImportIdentity, TenantImportPlan, TenantImportPlanner, TenantImportResult, TenantRecord, TenantTableCatalog, TenantTableDescriptor, TenantThemeAccess } from '@fromcode119/core';

/**
 * Moving a whole SITE: exporting it to an archive, previewing an import, executing one, adopting a
 * deployment as its own first tenant, and deleting one.
 *
 * Every path here writes an archive BEFORE it destroys anything — delete included. A site is the
 * customer's data, and the only acceptable version of "are you sure" is one that can be undone.
 * Import is two-phase for the same reason: a preview reports what would change so the operator sees
 * it before any row moves.
 *
 * The base of `TenantAdminService`, which keeps creating, listing and updating a site. Archive work
 * is separated because it is the half that touches the filesystem and can destroy data.
 */
export abstract class TenantArchiveAdmin extends TenantAdminState {
  /**
   * `transitPassphrase` seals the archive's secrets so they survive the move to another deployment.
   *
   * Without one the credentials still travel, but encrypted under THIS deployment's key, which the
   * destination does not have — the integration then behaves exactly as if it had never been
   * configured. The admin could not supply one at all until now, so every archive it produced was
   * unsealed and every operator moving a site between deployments had to re-enter every password.
   */
  async exportTenant(id: string, actor: Record<string, unknown>, transitPassphrase: string | null = null): Promise<{ archivePath: string; backup: unknown; manifest: unknown }> {
    const tenant = await this.requireTenant(id);
    const result = await this.writeArchive(tenant, transitPassphrase);
    await this.record('tenant.export', tenant.slug, actor, { id: tenant.id, archive: path.basename(result.archivePath), rows: result.manifest.totalRows });
    return { archivePath: result.archivePath, backup: this.catalog.resolveByPath(result.archivePath), manifest: result.manifest.toJSON() };
  }

  /** Export first, ALWAYS; then erase. The typed slug is the operator's confirmation. */
  async deleteTenant(id: string, confirmSlug: string, actor: Record<string, unknown>): Promise<{ archive: string; deleted: Record<string, number>; files: number }> {
    const tenant = await this.requireTenant(id);
    if (CoercionUtils.toString(confirmSlug) !== tenant.slug) {
      throw new Error(`Type the site's slug ("${tenant.slug}") to confirm deletion.`);
    }
    const exported = await this.writeArchive(tenant);
    const tables = await this.tables();
    const outcome = await new TenantEraser(this.db, this.registry, tables, this.uploadsDir).erase(tenant, exported.archivePath);
    await this.record('tenant.delete', tenant.slug, actor, { id: tenant.id, archive: path.basename(exported.archivePath), ...outcome });
    await this.gateway.notify();
    return { archive: path.basename(exported.archivePath), ...outcome };
  }

  async previewImport(archivePath: string, identityInput: Record<string, unknown>): Promise<TenantImportPlan> {
    const reader = await TenantArchiveReader.open(archivePath);
    try {
      const identity = TenantImportIdentity.resolve(reader.manifest.tenant as unknown as Record<string, unknown>, identityInput);
      return await this.planner(await this.tables()).plan(reader, identity);
    } finally {
      reader.close();
    }
  }

  /** `transitPassphrase` must be the one the EXPORT used, when the archive says its secrets were sealed. */
  async executeImport(archivePath: string, identityInput: Record<string, unknown>, actor: Record<string, unknown>, transitPassphrase: string | null = null): Promise<TenantImportResult> {
    const reader = await TenantArchiveReader.open(archivePath);
    try {
      const identity = TenantImportIdentity.resolve(reader.manifest.tenant as unknown as Record<string, unknown>, identityInput);
      const tables = await this.tables();
      const plan = await this.planner(tables).plan(reader, identity);
      // Refuse rather than land credentials nobody can read — the same guard the CLI applies. The
      // failure this exists to end is an integration that behaves as though it were never configured.
      if (reader.manifest.secretsSealed && !transitPassphrase) {
        throw new Error('This archive\'s secrets were sealed for transit. Enter the passphrase the export used, or the credentials arrive unreadable.');
      }
      const result = await new TenantImportExecutor(this.db, this.registry, tables, this.uploadsDir, transitPassphrase).execute(reader, identity, plan);
      await this.record('tenant.import', result.tenant.slug, actor, { id: result.tenant.id, archive: path.basename(archivePath), rows: result.totalRows, remapped: result.remappedTables });
    await this.gateway.notify();
      return result;
    } finally {
      reader.close();
    }
  }

  async adopt(identityInput: Record<string, unknown>, actor: Record<string, unknown>): Promise<unknown> {
    const identity = TenantIdentity.from(identityInput);
    // COLUMNS FIRST. Adoption stamps the rows of every table that has a `tenant_id` column, and on a
    // deployment whose tables predate tenancy none of them do — the column only arrives on the next
    // boot, once a tenant exists and the sweep runs. Adopting before that stamped nothing in those
    // tables and left their rows ownerless, which row-level security then hid from everyone.
    await new TenantColumnPreparer(this.db).ensureColumns(this.manager.systemCollectionTables());
    const tables = await new TenantTableCatalog(this.db, this.manager.registeredCollections.values()).byColumn();
    const outcome = await new TenantAdoptionService(this.db, this.registry, tables).adopt(identity);
    await this.record('tenant.adopt', identity.slug, actor, { id: identity.id, stamped: outcome.stamped, members: outcome.members, unassigned: outcome.unassigned });
    await this.gateway.notify();
    return { ...outcome, tenant: TenantSummary.tenantJson(outcome.tenant) };
  }

  /** Installed inventory the import planner compares the archive against, and the create form offers. */
  installed(): {
    plugins: Array<{ slug: string; version: string; name: string }>;
    themes: Array<{ slug: string; version: string; name: string }>;
    appearances: Array<{ slug: string; version: string; name: string }>;
    presets: Array<Record<string, unknown>>;
  } {
    return {
      // EVERY installed plugin, with its platform state — not only the runnable ones. Filtering the
      // rest out silently is what made the site form look like the platform had fewer plugins than it
      // does: a held or disabled plugin simply vanished, with no row and no reason.
      plugins: this.manager.getPlugins()
        .map((plugin) => ({
          slug: plugin.manifest.slug,
          version: String(plugin.manifest.version || ''),
          name: String(plugin.manifest.name || plugin.manifest.slug),
          state: String(plugin.state ?? ''),
          heldReason: String((plugin as { heldReason?: unknown }).heldReason ?? ''),
          runnable: plugin.state === PluginState.ACTIVE,
          // What the row shows beside the name — the same description and icon the Plugins page uses,
          // so the two lists read as the same kind of thing rather than one being a stripped copy.
          description: String(plugin.manifest.description || ''),
          icon: String((plugin.manifest as { admin?: { icon?: unknown } }).admin?.icon || 'Box'),
        })),
      themes: this.themeManager.getThemes().map((theme) => ({ slug: theme.slug, version: String(theme.version || ''), name: String(theme.name || theme.slug) })),
      appearances: this.appearances.list().map((entry) => ({ slug: entry.slug, version: String(entry.version || ''), name: String(entry.name || entry.slug) })),
      presets: this.presets().map((preset) => preset.toJSON()),
    };
  }

  protected async writeArchive(tenant: TenantRecord, transitPassphrase: string | null = null): Promise<{ archivePath: string; manifest: TenantArchiveManifest }> {
    const tables = await this.tables();
    const source = TenantArchiveSource.tenant(this.db, tenant.id, this.uploadsDir);
    const enabled = await new PluginTenantStateService(this.db).listEnabled(tenant.id);
    const installed = new Map(this.installed().plugins.map((plugin) => [plugin.slug, plugin.version]));
    const choice = await TenantThemeAccess.choiceForAsync(tenant.id);
    const themeVersion = this.installed().themes.find((theme) => theme.slug === choice.activeSlug)?.version ?? '';
    const outputPath = path.join(BackupService.getBackupsDirectory(SystemConstants.BACKUPS.TENANTS_SUBDIR), TenantArchiveLayout.archiveName(tenant.slug, new Date()));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    return new TenantArchiveWriter(source, tables, transitPassphrase).write({
      tenant: { id: tenant.id, slug: tenant.slug, primaryHost: tenant.primaryHost, hostAliases: tenant.hostAliases, state: tenant.state, kind: tenant.kind.value, appearance: tenant.appearance },
      plugins: enabled.map((slug) => ({ slug, version: installed.get(slug) ?? '' })),
      theme: choice.activeSlug ? { slug: choice.activeSlug, version: themeVersion, config: choice.config } : null,
      outputPath,
    });
  }

  protected planner(tables: TenantTableDescriptor[]): TenantImportPlanner {
    const inventory = this.installed();
    return new TenantImportPlanner(this.db, this.registry, tables, {
      plugins: new Map(inventory.plugins.map((plugin) => [plugin.slug, plugin.version])),
      themes: new Map(inventory.themes.map((theme) => [theme.slug, theme.version])),
    }, this.uploadsDir, this.tenantTableCatalog().hasSchemaReferences);
  }

  protected tenantTableCatalog(): TenantTableCatalog {
    return new TenantTableCatalog(this.db, this.manager.registeredCollections.values());
  }

  protected async tables(): Promise<TenantTableDescriptor[]> {
    return this.tenantTableCatalog().byPolicy();
  }

  protected async summarize(tenant: TenantRecord): Promise<TenantSummary> {
    const [members, plugins, choice, appearance] = await Promise.all([
      this.db.count(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { where: { tenant_id: tenant.id } }),
      new PluginTenantStateService(this.db).listEnabled(tenant.id),
      TenantThemeAccess.choiceForAsync(tenant.id),
      this.siteAppearance(tenant),
    ]);
    // The member LIST is deliberately not loaded here. `list()` summarizes every site, and this used
    // to read every membership row and then issue one user lookup PER MEMBER — so a platform with eight
    // sites and a hundred thousand members each rendered the Sites page with hundreds of thousands of
    // queries. The count is a single COUNT; the roster is paged on demand (`members()` below).
    // A workspace serves a console, not a storefront, so counting pages for one would be noise.
    const pageCount = tenant.isWorkspace ? 0 : await this.pagesService.countPagesFor(tenant.id);
    return new TenantSummary(tenant, members, plugins, choice.activeSlug, this.lastExport(tenant.slug), pageCount, this.exports(tenant.slug), appearance);
  }

  /**
   * The appearance THIS tenant actually wears.
   *
   * A workspace's is the tenant row's own kind lock — `tenant.appearance` already has it. A site's
   * is its own `admin_appearance` SETTING (`_system_meta`, row-level-security-scoped), because
   * `TenantIdentity.appearanceFor` refuses to store one on the row for a site. Read on the site's
   * own connection scope, same as `applySiteAppearance` writes it, so this never answers with the
   * platform's own setting instead.
   */
  protected async siteAppearance(tenant: TenantRecord): Promise<string> {
    if (tenant.isWorkspace) return tenant.appearance;
    const row = await this.db.withTenant(tenant.id, () => this.db
      .findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.ADMIN_APPEARANCE })
      .catch(() => null));
    return String((row as any)?.value ?? '').trim();
  }

  /**
   * This site's export archives, newest first, as the catalog entries the download route accepts.
   *
   * A filename alone was useless: the card printed it and told the operator to find it on another page.
   * The catalog already assigns each archive an id, which is what `/system/admin/backups/:id/download`
   * takes — so the same list can be downloaded from where it is shown.
   */
  protected exports(slug: string): Array<{ id: string; filename: string; sizeBytes: number; modifiedAt: string }> {
    const dir = BackupService.getBackupsDirectory(SystemConstants.BACKUPS.TENANTS_SUBDIR);
    if (!fs.existsSync(dir)) return [];
    const own = new RegExp(`^tenant-${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d{4}-\\d{2}-\\d{2}T`);
    return fs.readdirSync(dir)
      .filter((name) => own.test(name) && name.endsWith(TenantArchiveLayout.EXTENSION))
      .sort()
      .reverse()
      .map((name) => {
        const item = this.catalog.resolveByPath(path.join(dir, name));
        return { id: item.id, filename: item.filename, sizeBytes: item.sizeBytes, modifiedAt: item.modifiedAt };
      });
  }

  protected lastExport(slug: string): string | null {
    const dir = BackupService.getBackupsDirectory(SystemConstants.BACKUPS.TENANTS_SUBDIR);
    if (!fs.existsSync(dir)) return null;
    // `tenant-<slug>-<ISO timestamp>` — anchored on the digits, or "acme" would claim "acme-copy"'s archives.
    const own = new RegExp(`^tenant-${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d{4}-\\d{2}-\\d{2}T`);
    const files = fs.readdirSync(dir).filter((name) => own.test(name) && name.endsWith(TenantArchiveLayout.EXTENSION)).sort();
    return files.length ? files[files.length - 1] : null;
  }

  /** Members of a tenant, paged and searchable — delegated to TenantMembersService. */
  async members(tenantId: string, options: { q?: string; limit?: number; offset?: number } = {}) {
    return this.membersService.members(tenantId, options);
  }

  async addMember(tenantId: string, email: string, roles: string[]): Promise<void> {
    return this.membersService.addMember(tenantId, email, roles);
  }

  async removeMember(tenantId: string, userId: string): Promise<void> {
    return this.membersService.removeMember(tenantId, userId);
  }

  /** Create the tenant's pages from theme + plugin contracts — delegated to TenantPagesService. */
  async materializePages(tenantId: string): Promise<{ pages: number; themeSeeded: boolean; warnings: string[] }> {
    return this.pagesService.materializePages(tenantId);
  }

  protected async requireTenant(id: string): Promise<TenantRecord> {
    const tenant = await this.registry.get(id);
    if (!tenant) throw new Error(`Tenant "${id}" was not found.`);
    return tenant;
  }


  protected static slugs(value: unknown): string[] {
    return Array.isArray(value) ? [...new Set(value.map((entry) => CoercionUtils.toString(entry)).filter(Boolean))] : [];
  }

  protected async record(action: string, resource: string, actor: Record<string, unknown>, metadata: Record<string, unknown>): Promise<void> {
    await this.audit.recordOperation({ action, resource, status: AuditOutcome.ALLOWED, metadata: { ...actor, ...metadata } });
  }
}
