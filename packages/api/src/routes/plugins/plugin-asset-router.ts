import { BaseRouter } from '../../routers/base-router';
import { PluginManager } from '@fromcode119/core';
import { PluginController } from '../../controllers/plugins/plugin-controller';
import { RouteConstants } from '@fromcode119/core';

export class PluginAssetRouter extends BaseRouter {
  private controller: PluginController;

  constructor(private manager: PluginManager) {
    super();
    this.controller = new PluginController(manager);
  }

  protected registerRoutes(): void {
    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_UI_WILDCARD, this.bind(this.controller.serveAssets.bind(this.controller)));
  }
}