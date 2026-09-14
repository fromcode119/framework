import { PluginTenantAccess, RequestContextUtils, TenantResolverService } from '@fromcode119/core';
import { Request, Response } from 'express';
import { PluginState, SystemConstants, SystemSettingsExposureUtils } from '@fromcode119/core';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';
import { AdminNavigationScopeFilter } from '@api/services/system/admin-navigation-scope-filter';
import { SiteVisibilityGate } from '@api/server/site-visibility-gate';

/**
 * The metadata documents the admin and the storefront boot from — navigation, enabled plugins,
 * theme and exposed settings, assembled per request and per tenant.
 *
 * Split out of SystemAdminController (531 lines) 2026-09-09 — one concern per controller, matching the
 * other system controllers. Composed by SystemController with the same runtime.
 */
export class SystemMetadataController {
  constructor(private readonly runtime: SystemControllerRuntime) {}

  async getAdminMetadata(req: Request, res: Response) {
    try {
      const metadata = await this.runtime.manager.getAdminMetadata() as any;
      const runtimeModules = this.runtime.manager.getRuntimeModules();
      const frontendMeta = await this.runtime.themeManager.getFrontendMetadata(runtimeModules);

      if (frontendMeta?.activeTheme) {
        metadata.activeTheme = {
          ...frontendMeta.activeTheme,
          ui: { ...(frontendMeta.activeTheme.ui || {}), css: [], entry: undefined },
        };
      }
      if (frontendMeta?.runtimeModules) {
        metadata.runtimeModules = frontendMeta.runtimeModules;
      }

      const settings = await this.runtime.db.find(SystemConstants.TABLE.META);
      // This route is `auth.guard()` — ANY authenticated user, including a storefront customer.
      // Only declared, operator-visible settings may leave here; the raw table also holds every
      // user's TOTP secret/recovery codes and the SCIM + API machine tokens.
      metadata.settings = SystemSettingsExposureUtils.toExposableSettingsMap(settings);
      metadata.secondaryPanel = metadata.secondaryPanel || this.runtime.buildDefaultSecondaryPanel();
      // Two filters, one place. Platform-only entries (Sites, Sources) never reach a tenant admin's
      // payload; site-only entries never reach an operator standing on no site, because with no
      // tenant bound their screens would answer zero rows and say nothing about why. Both are applied
      // HERE, server side: hiding in the client would still hand the payload out.
      const isPlatformAdmin = await this.runtime.isPlatformAdmin(req);
      const menu = AdminNavigationScopeFilter.apply(metadata.menu, isPlatformAdmin);
      const panel = AdminNavigationScopeFilter.applyToPanel(metadata.secondaryPanel, isPlatformAdmin);
      metadata.menu = menu.menu;
      metadata.secondaryPanel = panel.panel;
      // What scope this payload describes, and which paths it withheld — so the console can say
      // "this page belongs to a site" for a bookmarked link instead of rendering an empty screen.
      metadata.scope = AdminNavigationScopeFilter.hasSite() ? 'site' : 'platform';
      metadata.siteScopedPaths = [...new Set([...menu.removedPaths, ...panel.removedPaths])];
      res.json(metadata);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }


  async getFrontendMetadata(req: Request, res: Response) {
    const metadata = await this.runtime.themeManager.getFrontendMetadata(this.runtime.manager.getRuntimeModules());
    const adminMetadata = await this.runtime.manager.getAdminMetadata() as any;
    const publicSettings = await this.runtime.publicFrontendSettings.getSettings(this.runtime.db);
    // Per-plugin, security-filtered settings (only fields flagged `public: true`) keyed by
    // namespace/slug — consumed by the storefront via `runtime.globalSettings`.
    const pluginPublicSettings = await this.runtime.manager.getPublicFrontendPluginSettings();
    // Both axes (T2): a tenant's storefront lists — and server-renders with — only the plugins its site
    // runs. The frontend derives its render signature from this list, so two sites with different plugin
    // sets get different SSR worlds, and a plugin a site does not run never contributes a slot to its pages.
    const plugins = this.runtime.manager.getSortedPlugins(
      this.runtime.manager.getPlugins().filter((plugin: any) =>
        plugin.state === PluginState.ACTIVE && PluginTenantAccess.isEnabledForCurrentTenant(plugin.manifest.slug))
    ).map((plugin: any) => ({
      namespace: plugin.manifest.namespace,
      slug: plugin.manifest.slug,
      version: plugin.manifest.version,
      name: plugin.manifest.name,
      capabilities: plugin.manifest.capabilities,
      ui: {
        ...(plugin.manifest.ui || {}),
        headInjections: this.runtime.manager.getHeadInjections(plugin.manifest.slug),
      },
    }));

    // How many server-render worlds the storefront keeps resident (Settings → Infrastructure). The
    // frontend reads it off this payload rather than owning a constant, so the operator's number is the
    // one in force; the default here mirrors the declared setting's own default and nothing else.
    const capRow = await this.runtime.db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.SSR_GENERATION_CAP }).catch(() => null);
    const declaredCap = Number(capRow?.value);
    const ssrGenerationCap = Number.isFinite(declaredCap) && declaredCap >= 1 ? Math.floor(declaredCap) : SystemConstants.SSR_GENERATION_CAP_DEFAULT;
    // T5b: each resident world is a process; its heap ceiling and per-render deadline are declared here too.
    const declaredNumber = async (key: string, fallback: number) => {
      const row = await this.runtime.db.findOne(SystemConstants.TABLE.META, { key }).catch(() => null);
      const value = Number(row?.value);
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
    };
    const ssrRenderMemoryMb = await declaredNumber(SystemConstants.META_KEY.SSR_RENDER_MEMORY_MB, SystemConstants.SSR_RENDER_MEMORY_MB_DEFAULT);
    const ssrRenderTimeoutMs = await declaredNumber(SystemConstants.META_KEY.SSR_RENDER_TIMEOUT_MS, SystemConstants.SSR_RENDER_TIMEOUT_MS_DEFAULT);

    // WHICH SITE this is and whether it is open yet. The storefront cannot ask the tenant table — it
    // has no tenant knowledge, it forwards a host and the api resolves — so the one payload it
    // already fetches per render is where the answer belongs. It decides the robots directive and,
    // for a site that is not published, whether to render at all.
    const tenantId = RequestContextUtils.getTenantId();
    const site = tenantId
      ? await TenantResolverService.shared(this.runtime.db).resolveById(tenantId)
      : null;

    // A private site's answer is not cacheable at the edge: it changes the moment somebody presses
    // Publish, and a cached "closed" would outlive the decision.
    res.set('Cache-Control', site && !site.isIndexable
      ? 'no-store'
      : 'public, max-age=30, stale-while-revalidate=300');
    res.json({
      ...metadata,
      site: site
        ? {
          id: site.id,
          slug: site.slug,
          visibility: String(site.visibility.value),
          // Told to every visitor, not just preview holders: a non-production site is one whose
          // checkout will refuse, and somebody testing it deserves to know that before they try
          // rather than after.
          environment: String(site.environment.value),
          isProduction: site.environment.isProduction,
          isIndexable: site.isIndexable,
          isReadable: site.isReadable,
          // Whether THIS caller may read a site that is not published. The storefront cannot work
          // this out — it holds an opaque cookie and knows nothing about sites — so the payload it
          // already fetches per render is where the answer belongs. It decides whether to render the
          // site at all, and whether to say out loud that only this person can see it.
          //
          // ASKED ONLY OF A CLOSED SITE, and that is not an optimisation. A readable site's payload
          // is cached at the edge for everyone; a per-caller answer inside it would be served to the
          // next anonymous visitor, who would then be told a published site is private. A closed
          // site's payload is `no-store` (below), which is what makes a per-caller field safe there.
          preview: site.isReadable ? false : await new SiteVisibilityGate(this.runtime.db).canPreview(site, req),
        }
        : null,
      menu: Array.isArray(adminMetadata?.menu)
        ? adminMetadata.menu
        : (Array.isArray((metadata as any)?.menu) ? (metadata as any).menu : []),
      plugins,
      publicSettings,
      settings: pluginPublicSettings,
      ssrGenerationCap,
      ssrRenderMemoryMb,
      ssrRenderTimeoutMs,
    });
  }
}
