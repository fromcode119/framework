import fs from 'fs';
import path from 'path';
import type { IDatabaseManager } from '@fromcode119/database';
import {
  AuditOutcome, BackupCatalogService, BackupService, CoercionUtils, PluginManager, PluginState, PluginTenantStateService, SystemConstants,
  TenantAdoptionService, TenantArchiveLayout, TenantArchiveManifest, TenantArchiveReader, TenantArchiveSource, TenantArchiveWriter, TenantEraser, TenantIdentity,
  TenantImportExecutor, TenantImportPlan, TenantImportPlanner, TenantImportResult, TenantMembershipService, TenantMode, TenantRecord,
  TenantRegistryService, TenantResolverService, TenantTableCatalog, TenantTableDescriptor, TenantThemeAccess, TenantThemeStateService, ThemeManager,
  PluginTenantAccess, RequestContextUtils, AppearanceManager, Logger, TenantKindPreset, TenantKindPresets, StringUtils, StorefrontPagesCollection } from '@fromcode119/core';

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

/**
 * Counting and materializing a tenant's CMS pages from the theme and plugin page contracts.
 *
 * Split out of TenantAdminService (481 lines) 2026-09-09; that service composes this one and delegates,
 * so the controller's surface is unchanged.
 */
export class TenantPagesService {
  constructor(
    private readonly db: IDatabaseManager,
    private readonly manager: PluginManager,
    private readonly themeManager: ThemeManager,
    private readonly lookup: TenantLookup,
  ) {}

  /** How many pages the site holds, through the registered pages collection — never a plugin's table name. */
  /**
   * A site's page count, on the connection the query actually runs on.
   *
   * Both halves matter and the first version had neither right: `countPages` reads through
   * `manager.db` (the RUNTIME connection) while this scoped `this.db` — the schema OWNER connection —
   * so the scope was applied to a connection the query never used. And row-level security is not the
   * only gate: the request context carries the tenant too. A site with 44 pages reported 0, and the
   * page then told the operator its storefront was empty.
   */
  async countPagesFor(tenantId: string): Promise<number> {
    return RequestContextUtils.storage.run({ locale: '', tenantId }, () =>
      this.manager.db.withTenant(tenantId, () => this.countPages()));
  }


  /**
   * How many pages the site in scope has.
   *
   * The collection is the one its OWNER marked as the storefront's pages, not a literal `'pages'`
   * matched here — framework code naming a plugin's collection is the coupling that rule forbids. No
   * marked collection means no pages plugin is installed, and the answer is zero rather than a guess.
   */
  private async countPages(): Promise<number> {
    const owner = StorefrontPagesCollection.find(this.manager.registeredCollections);
    if (!owner) return 0;

    // COUNT, not a capped find: the old form loaded up to 5000 rows and reported their length, so a
    // site with more pages than that under-reported.
    return CoercionUtils.toNumber(
      await this.manager.db.count(`@${owner.pluginSlug}/${owner.shortSlug}`, { where: {} }),
    );
  }


  /**
   * Create the default pages of the plugins this site runs (/shop, /login, /account, …) INSIDE the
   * site's tenant scope. A site created without this had no pages at all: every storefront route but
   * the home page was a 404. Runs at creation and on demand (`POST /:id/pages`), so a site that gained
   * a plugin later can catch up; existing pages are matched, never duplicated.
   */
  async materializePages(tenantId: string): Promise<{ pages: number; themeSeeded: boolean; warnings: string[] }> {
    const tenant = await this.lookup.requireTenant(tenantId);
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
        // Plugin seed data is per-site: skipped at boot (no site there), run here, inside this
        // tenant's scope, which is what makes the write pass row-level security.
        try {
          await this.manager.runPluginSeedsForCurrentSite();
        } catch (error: any) {
          warnings.push(`Plugin seeds: ${error?.message || error}`);
        }
        await this.manager.materializeDefaultPages();
      }));
    const pages = await this.manager.db.withTenant(tenant.id, () => this.countPages());
    return { pages, themeSeeded, warnings };
  }
}
