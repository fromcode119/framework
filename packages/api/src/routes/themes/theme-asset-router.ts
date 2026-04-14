import { BaseRouter } from '../../routers/base-router';
import { ThemeManager } from '@fromcode119/core';
import { ThemeController } from '../../controllers/themes/theme-controller';
import { RouteConstants } from '@fromcode119/core';

export class ThemeAssetRouter extends BaseRouter {
  private controller: ThemeController;

  constructor(private manager: ThemeManager) {
    super();
    this.controller = new ThemeController(manager);
  }

  protected registerRoutes(): void {
    this.get(RouteConstants.SEGMENTS.THEMES_SLUG_UI_WILDCARD, this.bind(this.controller.serveAssets.bind(this.controller)));
  }
}