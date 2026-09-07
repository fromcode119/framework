import fs from 'fs';
import path from 'path';
import type { IDatabaseManager } from '@fromcode119/database';
import {
  AuditOutcome, BackupCatalogService, BackupService, CoercionUtils, PluginManager, PluginState, PluginTenantStateService, SystemConstants,
  TenantAdoptionService, TenantArchiveLayout, TenantArchiveManifest, TenantArchiveReader, TenantArchiveSource, TenantArchiveWriter, TenantEraser, TenantIdentity,
  TenantImportExecutor, TenantImportPlan, TenantImportPlanner, TenantImportResult, TenantMembershipService, TenantMode, TenantRecord,
  TenantRegistryService, TenantResolverService, TenantTableCatalog, TenantTableDescriptor, TenantThemeAccess, TenantThemeStateService, ThemeManager,
  PluginTenantAccess, RequestContextUtils, AppearanceManager, Logger, TenantKindPreset, TenantKindPresets,
} from '@fromcode119/core';
import { SystemBackupRepository } from '@api/repositories/system-backup-repository';
import { GatewayReloadClient } from '@api/services/tenants/gateway-reload-client';
import { TenantSummary } from '@api/services/tenants/tenant-summary';

/**
 * Everything the Sites admin can do to a tenant, in one place, on the OWNER connection.
 *
 * The owner (`schemaDb`) is deliberate: exports and deletes read and write across a whole tenant
 * under `withTenant`, imports insert rows carrying explicit ids and advance sequences, adoption
 * stamps every table. The request connection (`fromcode_app`) is the wrong actor for all of that —
 * and every one of these is already behind `PlatformAdminGuard`.
 *
 * Every operation that changes what exists is recorded in the backup audit table, with the actor.
 */
export class TenantAdminService {
  private readonly db: IDatabaseManager;
  private readonly registry: TenantRegistryService;
  private readonly memberships: TenantMembershipService;
  private readonly catalog: BackupCatalogService;
  private readonly audit: SystemBackupRepository;
  private readonly appearances: AppearanceManager;
  private readonly gateway = new GatewayReloadClient();

  constructor(
    private readonly manager: PluginManager,
    private readonly themeManager: ThemeManager,
    private readonly uploadsDir: string,
  ) {
    this.db = ((manager as any).schemaDb ?? manager.db) as IDatabaseManager;
    this.registry = new TenantRegistryService(this.db, TenantResolverService.shared(manager.db));
    this.memberships = new TenantMembershipService(this.db);
    this.catalog = new BackupCatalogService();
    this.audit = new SystemBackupRepository(manager.db);
    this.appearances = new AppearanceManager(new Logger({ namespace: 'appearance' }));
  }

  get multiTenant(): boolean {
    return TenantMode.isEnabled();
  }

  async list(): Promise<TenantSummary[]> {
    const tenants = await this.registry.list();
    return Promise.all(tenants.map((tenant) => this.summarize(tenant)));
  }

  async get(id: string): Promise<TenantSummary> {
    const tenant = await this.requireTenant(id);
    return this.summarize(tenant);
  }

  async create(input: Record<string, unknown>, actor: Record<string, unknown>): Promise<TenantSummary> {
    // A workspace may start from a preset an installed appearance declares (its plugins, locked to that
    // appearance); anything passed explicitly wins over the preset. Validated BEFORE the row exists.
    const presetId = CoercionUtils.toString(input.preset);
    const preset = presetId ? TenantKindPresets.find(this.presets(), presetId) : undefined;
    if (presetId && !preset) throw new Error(`Unknown workspace preset "${presetId}".`);
    const identity = TenantIdentity.from({ ...input, appearance: input.appearance ?? preset?.appearance });
    if (identity.kind.isWorkspace) this.assertAppearanceInstalled(identity.appearance);
    const requested = TenantAdminService.slugs(input.plugins);
    const plugins = requested.length ? requested : [...(preset?.plugins ?? [])];
    this.assertPluginsInstalled(plugins);
    const theme = CoercionUtils.toString(input.theme);
    if (identity.kind.isWorkspace && theme) throw new Error('A workspace has no storefront, so it takes no theme.');

    const tenant = await this.registry.create(identity);
    const pluginState = new PluginTenantStateService(this.db);
    for (const slug of plugins) await pluginState.enable(tenant.id, slug);
    if (theme) await new TenantThemeStateService(this.db).activate(tenant.id, theme);
    const adminEmail = CoercionUtils.toKey(input.adminEmail);
    if (adminEmail) await this.addMember(tenant.id, adminEmail, ['admin']);
    // Pages are a storefront's; a workspace's domain serves the console.
    if (!tenant.isWorkspace) await this.materializePages(tenant.id);
    await this.record('tenant.create', tenant.slug, actor, { id: tenant.id, kind: tenant.kind.value, appearance: tenant.appearance, hosts: tenant.hosts(), plugins, theme, preset: preset?.id ?? null });
    await this.gateway.notify();
    return this.summarize(tenant);
  }

  /** The workspace presets on offer: one per installed appearance that declares a `workspace` block. */
  private presets(): TenantKindPreset[] {
    return TenantKindPresets.fromAppearances(this.appearances.list());
  }

  private assertAppearanceInstalled(appearance: string): void {
    if (!appearance) return;
    const installed = this.appearances.list().map((entry) => entry.slug);
    if (!installed.includes(appearance)) throw new Error(`Appearance "${appearance}" is not installed on this platform (installed: ${installed.join(', ') || 'none'}).`);
  }

  private assertPluginsInstalled(plugins: string[]): void {
    const installed = new Set(this.installed().plugins.map((plugin) => plugin.slug));
    const missing = plugins.filter((slug) => !installed.has(slug));
    if (missing.length) throw new Error(`Plugin(s) not installed on this platform: ${missing.join(', ')}.`);
  }

  /** How many pages the site holds, through the registered pages collection — never a plugin's table name. */
  private async countPages(): Promise<number> {
    for (const entry of this.manager.registeredCollections.values()) {
      const collection: any = entry.collection;
      if ((collection.shortSlug || collection.slug) !== 'pages') continue;
      const rows = await this.manager.db.find(`@${entry.pluginSlug}/${collection.shortSlug || collection.slug}`, { limit: 5000 });
      return Array.isArray(rows) ? rows.length : 0;
    }
    return 0;
  }

  /**
   * Create the default pages of the plugins this site runs (/shop, /login, /account, …) INSIDE the
   * site's tenant scope. A site created without this had no pages at all: every storefront route but
   * the home page was a 404. Runs at creation and on demand (`POST /:id/pages`), so a site that gained
   * a plugin later can catch up; existing pages are matched, never duplicated.
   */
  async materializePages(tenantId: string): Promise<{ pages: number; themeSeeded: boolean; warnings: string[] }> {
    const tenant = await this.requireTenant(tenantId);
    PluginTenantAccess.invalidate(tenant.id);
    TenantThemeAccess.invalidate(tenant.id);
    await Promise.all([PluginTenantAccess.warm(tenant.id), TenantThemeAccess.warm(tenant.id)]);
    const warnings: string[] = [];
    let themeSeeded = false;
    await RequestContextUtils.storage.run({ locale: '', tenantId: tenant.id }, () =>
      this.manager.db.withTenant(tenant.id, async () => {
        // The theme's INITIAL content first (its pages and navigation), then the plugins' default
        // pages, which match what the seed created rather than duplicating it.
        const themeSlug = (await TenantThemeAccess.choiceForAsync(tenant.id)).activeSlug;
        if (themeSlug && !tenant.isWorkspace) {
          try {
            themeSeeded = (await this.themeManager.seedThemeForCurrentSite(themeSlug)).seeded;
          } catch (error: any) {
            warnings.push(`Theme "${themeSlug}" seed failed: ${error?.message || error}`);
          }
        }
        await this.manager.materializeDefaultPages();
      }));
    const pages = await this.manager.db.withTenant(tenant.id, () => this.countPages());
    return { pages, themeSeeded, warnings };
  }

  /**
   * Changes a site. Theme and plugin choices are applied here, not only at creation.
   *
   * They live in their own tables rather than on the tenant row, so `registry.update` cannot carry
   * them — which is why they were settable when a site was created and never afterwards. The same
   * services and the same validation `create` uses are reused, so the two paths cannot drift into
   * disagreeing about what a valid choice is.
   *
   * Both keys are OPTIONAL and absent means "leave alone": a patch that only renames a host must not
   * read as "this site now has no plugins".
   */
  async update(id: string, patch: Record<string, unknown>, actor: Record<string, unknown>): Promise<TenantSummary> {
    const current = await this.requireTenant(id);
    if (patch.appearance !== undefined && current.isWorkspace) this.assertAppearanceInstalled(CoercionUtils.toKey(patch.appearance));

    const { theme, plugins, ...row } = patch;
    if (theme !== undefined) {
      const slug = CoercionUtils.toString(theme);
      if (current.isWorkspace && slug) throw new Error('A workspace has no storefront, so it takes no theme.');
    }
    if (plugins !== undefined) this.assertPluginsInstalled(TenantAdminService.slugs(plugins));

    const tenant = await this.registry.update(id, row);
    if (plugins !== undefined) await this.applyPlugins(tenant.id, TenantAdminService.slugs(plugins));
    if (theme !== undefined) await this.applyTheme(tenant.id, CoercionUtils.toString(theme));

    await this.record('tenant.update', tenant.slug, actor, { id: tenant.id, patch });
    await this.gateway.notify();
    return this.summarize(tenant);
  }

  /** Brings the site's enabled plugins to exactly `wanted` — enabling what is new, disabling what left. */
  private async applyPlugins(tenantId: string, wanted: string[]): Promise<void> {
    const state = new PluginTenantStateService(this.db);
    const current = await state.listEnabled(tenantId);
    for (const slug of wanted.filter((entry) => !current.includes(entry))) await state.enable(tenantId, slug);
    for (const slug of current.filter((entry) => !wanted.includes(entry))) await state.disable(tenantId, slug);
    PluginTenantAccess.invalidate(tenantId);
  }

  /** Activates the chosen theme, or clears the current one when the choice is empty. */
  private async applyTheme(tenantId: string, slug: string): Promise<void> {
    const state = new TenantThemeStateService(this.db);
    const active = (await TenantThemeAccess.choiceForAsync(tenantId)).activeSlug;
    if (slug) await state.activate(tenantId, slug);
    else if (active) await state.disable(tenantId, active);
    TenantThemeAccess.invalidate(tenantId);
  }

  async addMember(tenantId: string, email: string, roles: string[]): Promise<void> {
    const user = await this.db.findOne(SystemConstants.TABLE.USERS, { email: email.trim().toLowerCase() });
    if (!user) throw new Error(`No account with email "${email}" exists on this platform. Create the account first.`);
    await this.memberships.grant(CoercionUtils.toString(user.id), tenantId, roles);
  }

  async removeMember(tenantId: string, userId: string): Promise<void> {
    await this.memberships.revoke(userId, tenantId);
  }

  /** Writes `backups/tenants/tenant-<slug>-<ts>.tar.gz` and returns the catalog entry the Backups page shows. */
  async exportTenant(id: string, actor: Record<string, unknown>): Promise<{ archivePath: string; backup: unknown; manifest: unknown }> {
    const tenant = await this.requireTenant(id);
    const result = await this.writeArchive(tenant);
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
      const identity = TenantAdminService.identityFor(reader, identityInput);
      return await this.planner(await this.tables()).plan(reader, identity);
    } finally {
      reader.close();
    }
  }

  async executeImport(archivePath: string, identityInput: Record<string, unknown>, actor: Record<string, unknown>): Promise<TenantImportResult> {
    const reader = await TenantArchiveReader.open(archivePath);
    try {
      const identity = TenantAdminService.identityFor(reader, identityInput);
      const tables = await this.tables();
      const plan = await this.planner(tables).plan(reader, identity);
      const result = await new TenantImportExecutor(this.db, this.registry, tables, this.uploadsDir).execute(reader, identity, plan);
      await this.record('tenant.import', result.tenant.slug, actor, { id: result.tenant.id, archive: path.basename(archivePath), rows: result.totalRows, remapped: result.remappedTables });
    await this.gateway.notify();
      return result;
    } finally {
      reader.close();
    }
  }

  async adopt(identityInput: Record<string, unknown>, actor: Record<string, unknown>): Promise<unknown> {
    const identity = TenantIdentity.from(identityInput);
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
      plugins: this.manager.getPlugins()
        .filter((plugin) => plugin.state === PluginState.ACTIVE)
        .map((plugin) => ({ slug: plugin.manifest.slug, version: String(plugin.manifest.version || ''), name: String(plugin.manifest.name || plugin.manifest.slug) })),
      themes: this.themeManager.getThemes().map((theme) => ({ slug: theme.slug, version: String(theme.version || ''), name: String(theme.name || theme.slug) })),
      appearances: this.appearances.list().map((entry) => ({ slug: entry.slug, version: String(entry.version || ''), name: String(entry.name || entry.slug) })),
      presets: this.presets().map((preset) => preset.toJSON()),
    };
  }

  private async writeArchive(tenant: TenantRecord): Promise<{ archivePath: string; manifest: TenantArchiveManifest }> {
    const tables = await this.tables();
    const source = TenantArchiveSource.tenant(this.db, tenant.id, this.uploadsDir);
    const enabled = await new PluginTenantStateService(this.db).listEnabled(tenant.id);
    const installed = new Map(this.installed().plugins.map((plugin) => [plugin.slug, plugin.version]));
    const choice = await TenantThemeAccess.choiceForAsync(tenant.id);
    const themeVersion = this.installed().themes.find((theme) => theme.slug === choice.activeSlug)?.version ?? '';
    const outputPath = path.join(BackupService.getBackupsDirectory(SystemConstants.BACKUPS.TENANTS_SUBDIR), TenantArchiveLayout.archiveName(tenant.slug, new Date()));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    return new TenantArchiveWriter(source, tables).write({
      tenant: { id: tenant.id, slug: tenant.slug, primaryHost: tenant.primaryHost, hostAliases: tenant.hostAliases, state: tenant.state, kind: tenant.kind.value, appearance: tenant.appearance },
      plugins: enabled.map((slug) => ({ slug, version: installed.get(slug) ?? '' })),
      theme: choice.activeSlug ? { slug: choice.activeSlug, version: themeVersion, config: choice.config } : null,
      outputPath,
    });
  }

  private planner(tables: TenantTableDescriptor[]): TenantImportPlanner {
    const inventory = this.installed();
    return new TenantImportPlanner(this.db, this.registry, tables, {
      plugins: new Map(inventory.plugins.map((plugin) => [plugin.slug, plugin.version])),
      themes: new Map(inventory.themes.map((theme) => [theme.slug, theme.version])),
    }, this.uploadsDir);
  }

  private async tables(): Promise<TenantTableDescriptor[]> {
    return new TenantTableCatalog(this.db, this.manager.registeredCollections.values()).byPolicy();
  }

  private async summarize(tenant: TenantRecord): Promise<TenantSummary> {
    const [members, plugins, choice] = await Promise.all([
      this.db.count(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { where: { tenant_id: tenant.id } }),
      new PluginTenantStateService(this.db).listEnabled(tenant.id),
      TenantThemeAccess.choiceForAsync(tenant.id),
    ]);
    const memberRows = await this.db.find(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { where: { tenant_id: tenant.id } });
    const memberList = await Promise.all((memberRows ?? []).map(async (row: any) => {
      const user = await this.db.findOne(SystemConstants.TABLE.USERS, { id: CoercionUtils.toString(row.user_id) });
      return { userId: CoercionUtils.toString(row.user_id), email: CoercionUtils.toString(user?.email), roles: TenantSummary.roles(row.roles), state: CoercionUtils.toString(row.state) };
    }));
    // A workspace serves a console, not a storefront, so counting pages for one would be noise.
    const pageCount = tenant.isWorkspace ? 0 : await this.db.withTenant(tenant.id, () => this.countPages());
    return new TenantSummary(tenant, members, plugins, choice.activeSlug, memberList, this.lastExport(tenant.slug), pageCount);
  }

  private lastExport(slug: string): string | null {
    const dir = BackupService.getBackupsDirectory(SystemConstants.BACKUPS.TENANTS_SUBDIR);
    if (!fs.existsSync(dir)) return null;
    // `tenant-<slug>-<ISO timestamp>` — anchored on the digits, or "acme" would claim "acme-copy"'s archives.
    const own = new RegExp(`^tenant-${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d{4}-\\d{2}-\\d{2}T`);
    const files = fs.readdirSync(dir).filter((name) => own.test(name) && name.endsWith(TenantArchiveLayout.EXTENSION)).sort();
    return files.length ? files[files.length - 1] : null;
  }

  private async requireTenant(id: string): Promise<TenantRecord> {
    const tenant = await this.registry.get(id);
    if (!tenant) throw new Error(`Tenant "${id}" was not found.`);
    return tenant;
  }

  private static identityFor(reader: TenantArchiveReader, input: Record<string, unknown>): TenantIdentity {
    const archived = reader.manifest.tenant;
    return TenantIdentity.from({
      id: input.id ?? input.slug ?? archived.slug,
      slug: input.slug ?? archived.slug,
      primaryHost: input.primaryHost ?? archived.primaryHost,
      hostAliases: input.hostAliases ?? archived.hostAliases,
      state: input.state ?? 'active',
      // Archives written before T6 carry no kind: they were exported from sites.
      kind: input.kind ?? (archived as { kind?: unknown }).kind ?? 'site',
      appearance: input.appearance ?? (archived as { appearance?: unknown }).appearance ?? '',
    });
  }

  private static slugs(value: unknown): string[] {
    return Array.isArray(value) ? [...new Set(value.map((entry) => CoercionUtils.toString(entry)).filter(Boolean))] : [];
  }

  private async record(action: string, resource: string, actor: Record<string, unknown>, metadata: Record<string, unknown>): Promise<void> {
    await this.audit.recordOperation({ action, resource, status: AuditOutcome.ALLOWED, metadata: { ...actor, ...metadata } });
  }
}
