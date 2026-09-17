import fs from 'fs';
import path from 'path';
import type { IDatabaseManager } from '@fromcode119/database';
import {
  AuditOutcome, BackupCatalogService, BackupService, CoercionUtils, PluginManager, PluginState, PluginTenantStateService, SystemConstants,
  TenantAdoptionService, TenantArchiveLayout, TenantColumnPreparer, TenantArchiveManifest, TenantArchiveReader, TenantArchiveSource, TenantArchiveWriter, TenantEnvironment, TenantEraser, TenantIdentity,
  TenantImportExecutor, TenantImportIdentity, TenantImportPlan, TenantImportPlanner, TenantImportResult, TenantMembershipService, TenantMode, TenantRecord,
  TenantRegistryService, TenantResolverService, TenantTableCatalog, TenantTableDescriptor, TenantThemeAccess, TenantThemeStateService, ThemeManager,
  PluginTenantAccess, RequestContextUtils, AppearanceManager, Logger, TenantKindPreset, TenantKindPresets, StringUtils, StorefrontPagesCollection } from '@fromcode119/core';
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
import { TenantLookup } from '@api/services/tenants/tenant-lookup';
import { TenantMembersService } from '@api/services/tenants/tenant-members-service';
import { TenantPagesService } from '@api/services/tenants/tenant-pages-service';
import { TenantArchiveAdmin } from '@api/services/tenants/tenant-archive-admin';

export class TenantAdminService extends TenantArchiveAdmin {


  constructor(
    manager: PluginManager,
    themeManager: ThemeManager,
    uploadsDir: string,
  ) {
    super();
    this.manager = manager;
    this.themeManager = themeManager;
    this.uploadsDir = uploadsDir;
    this.db = ((manager as any).schemaDb ?? manager.db) as IDatabaseManager;
    this.registry = new TenantRegistryService(this.db, TenantResolverService.shared(manager.db));
    this.memberships = new TenantMembershipService(this.db);
    this.catalog = new BackupCatalogService();
    this.audit = new SystemBackupRepository(manager.db);
    this.appearances = new AppearanceManager(new Logger({ namespace: 'appearance' }));
    // Assigned HERE, like every other declared field. It carried its own initialiser before the
    // split; moved onto the state base as `declare` that initialiser stopped running, so every
    // `this.gateway.notify()` — after creating, importing, renaming or deleting a site — threw
    // instead of reloading the platform gateway's host map.
    this.gateway = new GatewayReloadClient();
    this.lookup = new TenantLookup(this.registry);
    this.membersService = new TenantMembersService(this.db, this.memberships, this.lookup);
    this.pagesService = new TenantPagesService(this.db, manager, themeManager, this.lookup);
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
  protected presets(): TenantKindPreset[] {
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
    // A SITE's appearance is the per-site `admin_appearance` SETTING, not a column on the tenant
    // row — `TenantIdentity.appearanceFor` refuses to store one there for a site, because that
    // column is the workspace's kind lock. So it is split out of the row and written as the setting.
    //
    // It is assigned HERE, from platform scope, for the same reason a theme is: a tenant-bound
    // request is isolated and sees only what is already its own, so if the operator could not put a
    // site on an appearance from its record, nothing could ever put it on a new one.
    const siteAppearance = !current.isWorkspace && row.appearance !== undefined
      ? CoercionUtils.toKey(row.appearance)
      : undefined;
    if (siteAppearance !== undefined) {
      this.assertAppearanceInstalled(siteAppearance);
      delete row.appearance;
    }
    if (theme !== undefined) {
      const slug = CoercionUtils.toString(theme);
      if (current.isWorkspace && slug) throw new Error('A workspace has no storefront, so it takes no theme.');
    }
    if (plugins !== undefined) this.assertPluginsInstalled(TenantAdminService.slugs(plugins));

    const tenant = await this.registry.update(id, row);
    if (plugins !== undefined) await this.applyPlugins(tenant.id, TenantAdminService.slugs(plugins));
    if (theme !== undefined) await this.applyTheme(tenant.id, CoercionUtils.toString(theme));
    if (siteAppearance !== undefined) await this.applySiteAppearance(tenant.id, siteAppearance);

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

  /**
   * Writes the site's `admin_appearance` setting — the one an operator assigns from the site record.
   *
   * Inside `withTenant` on the owner connection: the owner is a superuser and bypasses row-level
   * security, so without this scope the write would land on whichever `_system_meta` row the
   * unbound connection sees — the PLATFORM's — and restyle the operator's own console instead of
   * the site's. The empty slug means the built-in default, and is stored as `''` rather than
   * deleted, so the setting keeps saying what was chosen.
   */
  private async applySiteAppearance(tenantId: string, slug: string): Promise<void> {
    const key = SystemConstants.META_KEY.ADMIN_APPEARANCE;
    const value = slug === 'default' ? '' : slug;
    await this.db.withTenant(tenantId, async () => {
      const existing = await this.db.findOne(SystemConstants.TABLE.META, { key });
      if (existing) await this.db.update(SystemConstants.TABLE.META, { key }, { value, updated_at: new Date() });
      else await this.db.insert(SystemConstants.TABLE.META, { key, value, updated_at: new Date() });
    });
  }

  /** Activates the chosen theme, or clears the current one when the choice is empty. */
  private async applyTheme(tenantId: string, slug: string): Promise<void> {
    const state = new TenantThemeStateService(this.db);
    const active = (await TenantThemeAccess.choiceForAsync(tenantId)).activeSlug;
    if (slug) await state.activate(tenantId, slug);
    else if (active) await state.disable(tenantId, active);
    TenantThemeAccess.invalidate(tenantId);
  }

  /** Writes `backups/tenants/tenant-<slug>-<ts>.tar.gz` and returns the catalog entry the Backups page shows. */
}