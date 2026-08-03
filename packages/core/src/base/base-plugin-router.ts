import type { IBasePluginRouterOptions } from '@core/base/interfaces/base-plugin-router-options.interface';
import { BaseRouter } from '@core/base/base-router';

export class BasePluginRouter extends BaseRouter {
  constructor(private readonly options: IBasePluginRouterOptions) {
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