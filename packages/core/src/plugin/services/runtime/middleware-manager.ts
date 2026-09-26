import type { IMiddlewareConfig } from '@core/interfaces/middleware-config.interface';
import { MiddlewareStage } from '@core/enums/middleware-stage.enum';

/**
 * Plugin middleware, run by stage from the api's request pipeline.
 *
 * The stage is resolved to its `MiddlewareStage` member on BOTH sides. Plugins declare it as a string
 * (`'post_auth'`) or as the member, the api dispatched with a string, and the comparison was `===` — so
 * a middleware registered with the member (every ISOLATED plugin's, since the host resolves it) was
 * never found for any stage and never ran. On a platform that isolates every plugin, that was all of
 * them — every settings-driven gate a plugin puts in front of its own collections enforced nothing.
 *
 * A plugin's middleware is keyed by plugin and id: registering it again REPLACES it. A restarted plugin
 * process re-runs its `onInit`, and appending left the previous process's stand-in first in the chain,
 * forwarding to a handler the new process never issued.
 */
export class MiddlewareManager {
  private middlewares: IMiddlewareConfig[] = [];

  public register(config: IMiddlewareConfig): void {
    const stage = MiddlewareStage.resolve(config.stage);
    this.middlewares = this.middlewares.filter((m) => !(m.id === config.id && m.pluginSlug === config.pluginSlug));
    this.middlewares.push({
      ...config,
      stage,
      priority: config.priority ?? 100
    });
  }

  public getByStage(stage: MiddlewareStage): IMiddlewareConfig[] {
    const wanted = MiddlewareStage.resolve(stage);
    return this.middlewares
      .filter(m => m.stage === wanted)
      .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }

  /**
   * Dispatches a middleware chain for a specific stage.
   * This allows dynamic middleware execution even if plugins are loaded after startup.
   */
  public async dispatch(stage: MiddlewareStage, req: any, res: any, next: (err?: any) => void): Promise<void> {
    const list = this.getByStage(stage);
    let index = 0;

    const run = async (err?: any) => {
      if (err) return next(err);
      if (index >= list.length) return next();

      const middleware = list[index++];
      try {
        // We use a regular function call instead of await if handler is not async
        // but wrap it in Promise.resolve just in case.
        await Promise.resolve(middleware.handler(req, res, run));
      } catch (e) {
        next(e);
      }
    };

    await run();
  }

  public unregisterByPlugin(pluginSlug: string): void {
    this.middlewares = this.middlewares.filter(m => m.pluginSlug !== pluginSlug);
  }

  public clear(): void {
    this.middlewares = [];
  }
}