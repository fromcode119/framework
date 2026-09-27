import { Request, Response } from 'express';
import { BaseController, CoercionUtils, Logger, PluginManager, PluginState, PluginTenantStateService, TenantMode } from '@fromcode119/core';
import { PluginSiteOfferStore } from '@api/controllers/plugins/plugin-site-offer-store';

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
    const plugins = slugs
      .map((slug) => this.manager.plugins.get(slug))
      .filter((plugin) => plugin && PluginState.resolve(plugin.state) === PluginState.ACTIVE)
      .map((plugin) => ({
        slug: plugin!.manifest.slug,
        name: plugin!.manifest.name,
        description: plugin!.manifest.description ?? '',
        version: plugin!.manifest.version,
        enabledHere: enabled.has(plugin!.manifest.slug),
      }));
    res.json({ plugins });
  }

  /** The platform offering an installed plugin to sites, or no longer offering it. */
  async setOffer(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params.slug);
    if (!this.manager.plugins.get(slug)) return res.status(404).json({ error: 'plugin_not_installed', message: `Plugin "${slug}" is not installed on this platform.` });
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
    if (!(await this.store.list()).includes(slug)) {
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
