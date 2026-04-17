import type { BasePluginRouterOptions } from './base-plugin-router.interfaces';
import { BaseRouter } from './base-router';

export class BasePluginRouter extends BaseRouter {
  constructor(private readonly options: BasePluginRouterOptions) {
    super();
  }

  protected registerBaseRoutes(): void {
    this.healthCheck(this.options);
    if (this.options.registerStatus) {
      this.statusCheck(this.options);
    }
  }

  protected registerRoutes(): void {
    // Plugin routers override this method.
  }
}