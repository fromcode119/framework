import { MiddlewareConfig, MiddlewareStage } from '../../types';

export class MiddlewareManager {
  private middlewares: MiddlewareConfig[] = [];

  public register(config: MiddlewareConfig): void {
    this.middlewares.push({
      ...config,
      priority: config.priority ?? 100
    });
  }

  public getByStage(stage: MiddlewareStage): MiddlewareConfig[] {
    return this.middlewares
      .filter(m => m.stage === stage)
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

  public clear(): void {
    this.middlewares = [];
  }
}