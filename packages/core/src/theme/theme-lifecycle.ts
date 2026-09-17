import fs from 'fs';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantMode } from '@core/tenant/tenant-mode';
import { TenantThemeAccess } from '@core/theme/tenant-theme-access';
import { TenantThemeStateService } from '@core/theme/tenant-theme-state-service';
import { ThemeDiscovery } from '@core/theme/theme-discovery';
import { ThemeState } from '@core/theme/enums/theme-state.enum';

/**
 * Changing which theme a site uses, and what happens to its content when that changes.
 *
 * Activation is the operation with consequences: it is per-SITE, it re-materialises default pages,
 * and it changes what every visitor sees — so it is bound to the tenant the request carries and
 * REFUSES when there is none rather than guessing which site was meant. Disable and delete face the
 * same question in reverse: a theme a site is using cannot simply vanish.
 *
 * A LINK in the chain that builds `ThemeManager` — the same shape the auth controllers already use.
 * The state it works on is declared once in `ThemeManagerState` at the bottom; `this` here is the
 * manager. That is what keeps these files small without a
 * constructor taking thirteen arguments, or an untyped `manager: any` passed around.
 */
export abstract class ThemeLifecycle extends ThemeDiscovery {
  /**
   * Run a theme's declared INITIAL content (its `seeds` file) for the site this request is bound to.
   * On a multi-site platform the install-time seed runs untenanted and can write no site's rows, so a
   * site gets its theme's pages and navigation here — at creation, or on demand from the Sites page.
   * A theme without seeds is a no-op; a theme whose seed file is missing reports it rather than
   * pretending.
   */
  async seedThemeForCurrentSite(slug: string): Promise<{ seeded: boolean; reason?: string }> {
    const manifest = this.themes.get(slug);
    if (!manifest) throw new Error(`Theme "${slug}" not found.`);
    if (!(manifest as any).seeds) return { seeded: false, reason: 'theme declares no seeds' };
    if (TenantMode.isEnabled()) this.requireTenant('seed a theme');
    await this.installer.runSeeds(manifest);
    return { seeded: true };
  }

  async activateTheme(slug: string) {
    const manifest = this.themes.get(slug);
    if (!manifest) throw new Error(`Theme "${slug}" not found.`);

    // MULTI-TENANT: activation is a SITE action. It writes the tenant's row, materializes the tenant's
    // default pages on this (tenant-bound) connection, and touches no file — so it needs no storefront
    // restart: the tenant's next request carries a new render signature and the renderer rebuilds.
    if (TenantMode.isEnabled()) {
      const tenantId = this.requireTenant('activate a theme');
      await new TenantThemeStateService(this.db).activate(tenantId, slug);
      await this.materializeDefaultPages();
      this.logger.info(`Theme "${slug}" activated for tenant "${tenantId}".`);
      this.pluginManager?.emit?.('theme:activated', { slug, manifest, tenantId });
      return;
    }

    const timestamp = new Date();
    const existing = await this.db.findOne(SystemConstants.TABLE.THEMES, { slug });
    const activeThemeRow = await this.db.findOne(SystemConstants.TABLE.THEMES, { state: ThemeState.ACTIVE.value });

    if (activeThemeRow && activeThemeRow.slug !== slug) {
      await this.db.update(SystemConstants.TABLE.THEMES, { slug: activeThemeRow.slug }, { state: ThemeState.INACTIVE.value, updated_at: timestamp });
    }

    if (existing) {
      await this.db.update(SystemConstants.TABLE.THEMES, { slug }, { state: ThemeState.ACTIVE.value, updated_at: timestamp });
    } else {
      await this.db.insert(SystemConstants.TABLE.THEMES, { slug, name: manifest.name, version: manifest.version, state: ThemeState.ACTIVE.value, created_at: timestamp, updated_at: timestamp });
    }

    await this.db.update(SystemConstants.TABLE.THEMES, { slug }, { state: ThemeState.ACTIVE.value, updated_at: timestamp });
    this.activeTheme = slug;
    await this.materializeDefaultPages();
    this.logger.info(`Theme "${slug}" activated.`);
    this.pluginManager?.emit?.('theme:activated', { slug, manifest });
    // A different theme means a different server-render bundle; the storefront loaded the previous
    // one at boot and cannot swap it in place.
    await this.refreshStorefrontRenderer(`theme "${slug}" activated`);
  }

  async disableTheme(slug: string) {
    const manifest = this.themes.get(slug);
    if (!manifest) throw new Error(`Theme "${slug}" not found.`);

    if (TenantMode.isEnabled()) {
      const tenantId = this.requireTenant('disable a theme');
      await new TenantThemeStateService(this.db).disable(tenantId, slug);
      this.logger.info(`Theme "${slug}" disabled for tenant "${tenantId}".`);
      this.pluginManager?.emit?.('theme:deactivated', { slug, tenantId });
      return;
    }

    const existing = await this.db.findOne(SystemConstants.TABLE.THEMES, { slug });
    if (!existing && this.activeTheme !== slug) {
      return;
    }

    await this.db.update(SystemConstants.TABLE.THEMES, { slug }, { state: ThemeState.INACTIVE.value, updated_at: new Date() });
    if (this.activeTheme === slug) {
      this.activeTheme = null;
    }

    this.logger.info(`Theme "${slug}" disabled.`);
    this.pluginManager?.emit?.('theme:deactivated', { slug });
  }

  async resetTheme(slug: string, options?: { runSeeds?: boolean; resetConfig?: boolean }) {
    const manifest = this.themes.get(slug);
    if (!manifest) throw new Error(`Theme "${slug}" not found.`);
    const runSeeds = options?.runSeeds !== false;
    const resetConfig = options?.resetConfig === true;
    if (resetConfig) {
      const existing = await this.db.findOne(SystemConstants.TABLE.THEMES, { slug });
      if (TenantMode.isEnabled()) {
        await new TenantThemeStateService(this.db).saveConfig(this.requireTenant('reset a theme'), slug, null);
      } else if (existing) {
        await this.db.update(SystemConstants.TABLE.THEMES, { slug }, { config: null });
      }
    }
    if (runSeeds) await this.installer.runSeeds(manifest);
    // Seeds and default pages write tenant-scoped rows; inside a request the connection is tenant-bound,
    // so on a multi-tenant deployment they land in the tenant that asked and nowhere else.
    if (this.getActiveThemeManifest()?.slug === slug) {
      await this.materializeDefaultPages();
    }
    this.logger.info(`Theme "${slug}" reset.`);
  }

  async saveThemeConfig(slug: string, config: { variables?: Record<string, string> }) {
    if (TenantMode.isEnabled()) {
      this.configService.validateThemeConfig(slug, config);
      return new TenantThemeStateService(this.db).saveConfig(this.requireTenant('configure a theme'), slug, config);
    }
    return this.configService.saveThemeConfig(slug, config);
  }

  async getThemeConfig(slug: string): Promise<any> {
    if (TenantMode.isEnabled()) {
      const choice = await TenantThemeAccess.choiceForAsync(this.requireTenant('read a theme config'));
      return choice.activeSlug === slug ? (choice.config || {}) : {};
    }
    return this.configService.getThemeConfig(slug);
  }

  async deleteTheme(slug: string) {
    if (TenantMode.isEnabled()) {
      // Every tenant's row for it goes, or a customer stays "active" on files that no longer exist and
      // its storefront logs NO SERVER RENDERING until someone notices. Said out loud, per tenant.
      const orphaned = await new TenantThemeStateService(this.db).clearForTheme(slug);
      for (const tenantId of orphaned) {
        this.logger.warn(`Theme "${slug}" was deleted while ACTIVE for tenant "${tenantId}": that site now renders with no theme.`);
      }
    } else if (this.activeTheme === slug) {
      await this.discoverThemes();
      const fallbackSlug = Array.from(this.themes.keys()).find((c) => c !== slug);
      if (fallbackSlug) {
        this.logger.info(`Theme "${slug}" is active. Activating fallback theme "${fallbackSlug}" before deletion.`);
        await this.activateTheme(fallbackSlug);
      } else {
        await this.db.update(SystemConstants.TABLE.THEMES, { state: ThemeState.ACTIVE.value }, { state: ThemeState.INACTIVE.value });
        this.activeTheme = null;
      }
    }
    const targetDir = this.resolveThemeDirectory(slug);
    if (fs.existsSync(targetDir)) { this.logger.info(`Deleting theme files at ${targetDir}`); fs.rmSync(targetDir, { recursive: true, force: true }); }
    this.themes.delete(slug);
    try { await this.db.delete(SystemConstants.TABLE.THEMES, { slug }); } catch (e: any) { this.logger.warn(`Failed to cleanup DB entries for deleted theme ${slug}: ${e.message}`); }
    this.logger.info(`Theme "${slug}" deleted.`);
  }
}
