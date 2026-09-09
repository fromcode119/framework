import { Request, Response } from 'express';
import fs from 'fs';
import { PluginManager, Logger, CoercionUtils, PluginRegistryHealth, PluginState, PluginTenantAccess, PluginTenantStateService, TenantMembershipService, TenantMode } from '@fromcode119/core';
import { PluginArchiveSupport } from '@api/controllers/plugins/plugin-archive-support';

/**
 * Enabling, disabling, re-approving and removing an installed plugin — platform-wide and per tenant.
 *
 * Split out of PluginController (483 lines) 2026-09-09, the same way PluginArchiveSupport was.
 * Routed directly by PluginRouter.
 */
export class PluginLifecycleController {
  private logger = new Logger({ namespace: 'plugin-controller' });

  constructor(private manager: PluginManager) {}

  /**
   * Turn a plugin on or off.
   *
   * ON A MULTI-TENANT DEPLOYMENT THIS IS A PER-TENANT ACTION. `_system_plugins` records installation
   * — one container, one filesystem, one copy of the code — and a tenant cannot install code, only
   * turn on code the operator already installed. So the toggle writes the tenant's enablement row
   * and touches the platform state not at all.
   *
   * No restart, and nothing is loaded or unloaded: the route/hook/namespace gates are consulted per
   * request, so invalidating the cache is the whole deployment step.
   */
  async toggle(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params.slug);
    const { enabled, force, recursive } = req.body;

    // `scope: 'platform'` is the operator-wide axis — is this plugin loadable AT ALL. It is a
    // platform-admin action and is refused for anyone else, because one customer must never be able
    // to take a plugin down for every other customer. Everything else on a multi-tenant deployment
    // means "for the site I am currently in".
    const platformScope = String((req.body as any)?.scope || '').trim() === 'platform';

    if (TenantMode.isEnabled() && !platformScope) {
      return this.toggleForTenant(req, res, String(slug), CoercionUtils.toBoolean(enabled) === true);
    }

    if (TenantMode.isEnabled() && platformScope) {
      const memberships = new TenantMembershipService((this.manager as any).schemaDb ?? this.manager.db);
      const isPlatformAdmin = await memberships.isPlatformAdminAccount(String((req as any).user?.id ?? ''));
      if (!isPlatformAdmin) {
        return res.status(403).json({ error: 'platform_admin_required' });
      }
      // Falls through to the platform path below, and every tenant's cached answer is dropped:
      // taking a plugin off the platform axis must not leave a tenant's gate saying yes.
      PluginTenantAccess.invalidate();
    }

    try {
      if (enabled) {
        await this.manager.enable(slug, {
          force: CoercionUtils.toBoolean(force),
          recursive: CoercionUtils.toBoolean(recursive)
        });
      } else {
        await this.manager.disable(slug);
      }
      res.json({ success: true, state: enabled ? 'active' : 'inactive' });
    } catch (err: any) {
      if (err.message.startsWith('DEPENDENCY_ISSUES:')) {
        try {
          const json = err.message.replace('DEPENDENCY_ISSUES: ', '');
          const issues = JSON.parse(json);
          return res.status(409).json({
            code: 'DEPENDENCY_REQUIRED',
            message: 'One or more required plugins are missing or inactive.',
            issues,
            plugin: slug
          });
        } catch (e) {}
      }

      const status = err.message.toLowerCase().includes('not found') ||
                     err.message.toLowerCase().includes('missing dependency') ||
                     err.message.toLowerCase().includes('incompatible') ? 400 : 500;
      this.logger.error(`Toggle failed for plugin "${slug}": ${err.message}`);
      res.status(status).json({ error: err.message });
    }
  }


  /**
   * The per-tenant half of `toggle`.
   *
   * A plugin that is not loadable at all (missing, or held for an integrity failure) cannot be
   * enabled for anyone — the two axes are independent and neither overrides the other. Saying so
   * here, rather than writing a row that the gate will refuse anyway, is the difference between an
   * operator seeing "this plugin is broken" and seeing a switch that turns on and does nothing.
   */
  private async toggleForTenant(req: Request, res: Response, slug: string, enabled: boolean) {
    const tenantId = String((req as any).tenantId || '').trim();
    if (!tenantId) {
      return res.status(400).json({ error: 'no_tenant_selected' });
    }

    const plugin = this.manager.plugins.get(slug);
    if (!plugin) {
      return res.status(404).json({ error: `Plugin "${slug}" is not installed on this platform.` });
    }
    if (enabled && plugin.state !== PluginState.ACTIVE) {
      return res.status(409).json({
        code: 'PLUGIN_NOT_AVAILABLE',
        error: `Plugin "${slug}" is installed but not available on this platform`
          + `${plugin.heldReason ? ` (${plugin.heldReason})` : ''}. It cannot be enabled for a site `
          + 'until that is resolved.',
      });
    }

    const service = new PluginTenantStateService((this.manager as any).schemaDb ?? this.manager.db);
    try {
      if (enabled) await service.enable(tenantId, slug);
      else await service.disable(tenantId, slug);
      return res.json({ success: true, tenantId, state: enabled ? 'active' : 'inactive' });
    } catch (err: any) {
      this.logger.error(`Tenant toggle failed for plugin "${slug}" on tenant "${tenantId}": ${err?.message}`);
      return res.status(500).json({ error: err?.message || String(err) });
    }
  }


  /** Re-approve + enable every plugin currently held on the warning axis (capability drift).
   *  enable() advances approvedCapabilities to the current manifest, so the hold clears. */
  async reapproveAll(_req: Request, res: Response) {
    const held = this.manager.getPlugins().filter(
      (p) => p.healthStatus === PluginRegistryHealth.WARNING || Boolean(p.heldReason),
    );
    const results: Array<{ slug: string; ok: boolean; error?: string }> = [];
    for (const p of held) {
      const slug = p.manifest.slug;
      try {
        await this.manager.enable(slug, { force: false, recursive: false });
        results.push({ slug, ok: true });
      } catch (err: any) {
        results.push({ slug, ok: false, error: err?.message || String(err) });
      }
    }
    res.json({ success: results.every((r) => r.ok), reapproved: results });
  }


  async delete(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params.slug);
    try {
      await this.manager.delete(slug);
      res.json({ success: true });
    } catch (err: any) {
      const isValidationError = err.message.toLowerCase().includes('cannot delete') ||
                               err.message.toLowerCase().includes('required by') ||
                               err.message.toLowerCase().includes('not found');

      const status = isValidationError ? 400 : 500;
      this.logger.error(`Delete failed for plugin "${slug}": ${err.message}`);
      res.status(status).json({ error: err.message });
    }
  }
}
