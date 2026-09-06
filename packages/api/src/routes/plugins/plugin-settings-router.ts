import { BaseRouter } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager } from '@fromcode119/core';
import { PluginSettingsController } from '@api/controllers/plugins/plugin-settings-controller';
import { RouteConstants } from '@fromcode119/core';
import { TenantPluginGuard } from '@api/middlewares/tenant-plugin-guard';

export class PluginSettingsRouter extends BaseRouter {
  private controller: PluginSettingsController;

  constructor(
    private manager: PluginManager,
    private auth: AuthManager,
    private tenantPlugin: TenantPluginGuard,
  ) {
    super();
    this.controller = new PluginSettingsController(manager);
  }

  protected registerRoutes(): void {
    const isAdmin = this.auth.guard(['admin']);
    // Settings are per tenant, so a tenant admin keeps them — but only for plugins this site RUNS.
    const forTenant = this.tenantPlugin.middleware();
    const c = this.controller;

    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS, isAdmin, forTenant, (req, res) => c.getSettings(req, res));
    this.put(RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS, isAdmin, forTenant, (req, res) => c.updateSettings(req, res));
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS, isAdmin, forTenant, (req, res) => c.updateSettings(req, res));
    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_SCHEMA, isAdmin, forTenant, (req, res) => c.getSchema(req, res));
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_RESET, isAdmin, forTenant, (req, res) => c.resetSettings(req, res));
    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_EXPORT, isAdmin, forTenant, (req, res) => c.exportSettings(req, res));
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_IMPORT, isAdmin, forTenant, (req, res) => c.importSettings(req, res));
  }
}