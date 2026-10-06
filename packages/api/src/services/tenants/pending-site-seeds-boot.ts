import type { IDatabaseManager } from '@fromcode119/database';
import { Logger, PluginManager, TenantMode, TenantRegistryService, TenantResolverService, ThemeManager } from '@fromcode119/core';
import { PendingSiteSeed } from '@api/services/tenants/pending-site-seed';
import { TenantLookup } from '@api/services/tenants/tenant-lookup';
import { TenantPagesService } from '@api/services/tenants/tenant-pages-service';

/**
 * Pays the content debt of sites created before this process could write for them (see
 * PendingSiteSeed). Runs once per boot, when sites are on and plugins are up.
 *
 * The debt is cleared whatever the outcome: a seed that fails halfway and is replayed at every boot
 * would overwrite what the operator then edited, and the failure is already on the record — logged
 * here with the reason, and replayable from Themes → Maintenance → Run seeds.
 */
export class PendingSiteSeedsBoot {
  private static readonly logger = new Logger({ namespace: 'site-seed' });

  static async run(manager: PluginManager, themeManager: ThemeManager): Promise<void> {
    if (!TenantMode.isEnabled()) return;
    const db = ((manager as any).schemaDb ?? manager.db) as IDatabaseManager;
    const pending = new PendingSiteSeed(db);
    const registry = new TenantRegistryService(db, TenantResolverService.shared(manager.db));
    const owing: string[] = [];
    for (const tenant of await registry.list()) {
      if (!tenant.isWorkspace && await pending.isOwed(tenant.id)) owing.push(tenant.id);
    }
    if (!owing.length) return;

    const pages = new TenantPagesService(db, manager, themeManager, new TenantLookup(registry));
    for (const tenantId of owing) {
      try {
        const outcome = await pages.materializePages(tenantId, { seedTheme: true });
        const detail = outcome.themeSeeded ? 'theme seeded' : `theme not seeded (${outcome.themeSeedReason})`;
        PendingSiteSeedsBoot.logger.info(`Site "${tenantId}": content created at boot, ${detail}, ${outcome.pages} page(s).`);
        for (const warning of outcome.warnings) PendingSiteSeedsBoot.logger.warn(`Site "${tenantId}": ${warning}`);
      } catch (error: any) {
        PendingSiteSeedsBoot.logger.error(`Site "${tenantId}": creating its content at boot failed: ${error?.message || error}`);
      } finally {
        await pending.clear(tenantId);
      }
    }
  }
}
