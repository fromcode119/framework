import { Request, Response } from 'express';
import { BaseController, CoercionUtils, Logger, PluginManager, PluginOwners, PluginState, PluginTenantStateService, TenantMode } from '@fromcode119/core';
import { PluginSiteOfferStore } from '@api/controllers/plugins/plugin-site-offer-store';
import { AdminSchemaLocalization } from '@api/services/system/admin-schema-localization';

/**
 * The plugins a SITE may add to itself: the ones the platform offers.
 *
 * Installing stays the platform's (it puts code on the box every site runs on, and approves what that
 * code may do). What a site may do is switch an OFFERED plugin on or off for itself — reviewed code
 * the platform chose, one shared process for every site that uses it, nothing new on the box.
 */
export class PluginSiteOfferController extends BaseController {
  private logger = new Logger({ namespace: 'plugin-site-offer' });
  private readonly store: PluginSiteOfferStore;

  constructor(private manager: PluginManager) {
    super();
    this.store = new PluginSiteOfferStore(manager.db);
  }

  /**
   * In a site: the offered plugins it can use now (installed and running on the platform), and whether
   * each is on here. In Platform scope: every offered slug, for the switches on the plugins' pages.
   */
  async offered(req: Request, res: Response) {
    const tenantId = String((req as any).tenantId || '').trim();
    const slugs = await this.store.list();
    if (!TenantMode.isEnabled() || !tenantId) return res.json({ offered: slugs });

    const enabled = new Set(await this.tenantState().listEnabled(tenantId));
    // Name and description in the console's language, as the installed list shows them.
    const localizer = await AdminSchemaLocalization.forRequest(this.manager, req);
    const describe = (plugin: any) => {
      const manifest = localizer.manifest(plugin.manifest.slug, plugin.manifest);
      return {
        slug: plugin.manifest.slug,
        name: manifest.name,
        description: manifest.description ?? '',
        version: plugin.manifest.version,
        enabledHere: enabled.has(plugin.manifest.slug),
      };
    };
    const plugins = slugs
      .map((slug) => this.manager.plugins.get(slug))
      .filter((plugin) => plugin && PluginState.resolve(plugin.state) === PluginState.ACTIVE)
      .map(describe);
    // This site's OWN uploads, running or not, so it can switch them and remove them.
    const own = PluginOwners.ownedBy(tenantId)
      .map((slug) => this.manager.plugins.get(slug))
      .filter(Boolean)
      .map((plugin) => ({
        ...describe(plugin),
        running: PluginState.resolve(plugin!.state) === PluginState.ACTIVE,
        error: plugin!.error ?? '',
        // Placed but waiting for the site admin's approval of what it asks for.
        needsApproval: Boolean(this.manager.consentSummary(plugin!.manifest.slug)?.requiresApproval),
      }));
    res.json({ plugins, own });
  }

  /** The platform offering an installed plugin to sites, or no longer offering it. */
  async setOffer(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params.slug);
    if (!this.manager.plugins.get(slug)) return res.status(404).json({ error: 'plugin_not_installed', message: `Plugin "${slug}" is not installed on this platform.` });
    if (PluginOwners.ownerOf(slug)) {
      return res.status(409).json({ error: 'plugin_owned_by_site', message: `"${slug}" is one site's own plugin and cannot be offered to other sites.` });
    }
    const offered = CoercionUtils.toBoolean(req.body?.offered) === true;
    const next = await this.store.set(slug, offered);
    res.json({ success: true, offered: next.includes(slug) });
  }

  /**
   * A site switching an offered plugin on or off for ITSELF. Anything the platform does not offer stays
   * the platform's to assign, and one that is not running on the platform cannot be switched on here.
   */
  async setForSite(req: Request, res: Response) {
    const tenantId = String((req as any).tenantId || '').trim();
    if (!TenantMode.isEnabled() || !tenantId) return res.status(400).json({ error: 'site_required', message: 'Choose a site first.' });
    const slug = CoercionUtils.toString(req.params.slug);
    const ownHere = PluginOwners.ownerOf(slug) === tenantId;
    if (!ownHere && !(await this.store.list()).includes(slug)) {
      return res.status(403).json({ error: 'plugin_not_offered', message: `"${slug}" is not offered to sites. The platform admin chooses which plugins sites may add.` });
    }
    const plugin = this.manager.plugins.get(slug);
    const enabled = CoercionUtils.toBoolean(req.body?.enabled) === true;
    if (enabled && (!plugin || PluginState.resolve(plugin.state) !== PluginState.ACTIVE)) {
      return res.status(409).json({ error: 'plugin_not_available', message: `"${slug}" is not running on the platform right now, so it cannot be switched on for a site.` });
    }
    try {
      if (enabled) await this.tenantState().enable(tenantId, slug);
      else await this.tenantState().disable(tenantId, slug);
      // The plugin's default pages exist for this site from the moment it is switched on, not from the
      // next restart; the pass is idempotent and scoped to the site this request is bound to.
      if (enabled) await this.manager.materializeDefaultPages();
      res.json({ success: true, enabled });
    } catch (err: any) {
      this.logger.error(`Site "${tenantId}" could not switch "${slug}" ${enabled ? 'on' : 'off'}: ${err?.message}`);
      res.status(500).json({ error: 'plugin_not_switched', message: String(err?.message || 'The plugin could not be switched.') });
    }
  }

  /** The same writer the platform's per-site switch uses (`PluginLifecycleController.toggleForTenant`). */
  private tenantState(): PluginTenantStateService {
    return new PluginTenantStateService((this.manager as any).schemaDb ?? this.manager.db);
  }
}
