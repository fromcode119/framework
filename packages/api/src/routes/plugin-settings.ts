import { BaseRouter } from '../routers/base-router';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager } from '@fromcode119/core';
import { PluginSettingsController } from '../controllers/plugin-settings-controller';
import { RouteConstants } from '@fromcode119/sdk';

/**
 * Plugin settings routes (get/update/reset/export/import settings).
 */
export class PluginSettingsRouter extends BaseRouter {
  private controller: PluginSettingsController;

  constructor(
    private manager: PluginManager,
    private auth: AuthManager
  ) {
    super();
    this.controller = new PluginSettingsController(manager);
  }

  protected registerRoutes(): void {
    const isAdmin = this.auth.guard(['admin']);
    const c = this.controller;

    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS, isAdmin, (req, res) => c.getSettings(req, res));
    this.put(RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS, isAdmin, (req, res) => c.updateSettings(req, res));
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS, isAdmin, (req, res) => c.updateSettings(req, res));
    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_SCHEMA, isAdmin, (req, res) => c.getSchema(req, res));
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_RESET, isAdmin, (req, res) => c.resetSettings(req, res));
    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_EXPORT, isAdmin, (req, res) => c.exportSettings(req, res));
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_IMPORT, isAdmin, (req, res) => c.importSettings(req, res));
  }
}