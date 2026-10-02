import express from 'express';
import type { NextFunction, Request, Response } from 'express';

/**
 * Where plugins' API routes live: one express Router PER PLUGIN, reached by the request's first path
 * segment — the plugin's slug, which every plugin route starts with (`/<slug>/…`, ApiContextProxy).
 *
 * All plugins' routes used to share ONE router, and express tries a router's routes in order, so a
 * request for one plugin was tested against the routes of every plugin registered before it — measured
 * under load, routing was the largest single share of the api's time on a plugin request. Each router
 * here holds exactly the routes it held before, with the same paths, in the same order, and is called
 * without a mount path, so a handler sees the same `req.url`, `req.path` and `req.baseUrl` as before.
 * A path whose first segment no plugin owns goes straight on, as it did after failing every route.
 *
 * Same router options as before (express's defaults): a path matches case-insensitively, so the slug
 * is looked up lower-cased.
 */
export class PluginApiHost {
  private readonly routers = new Map<string, express.Router>();

  readonly get = (path: string, ...handlers: any[]) => { this.routerFor(path).get(path, ...handlers); };
  readonly post = (path: string, ...handlers: any[]) => { this.routerFor(path).post(path, ...handlers); };
  readonly put = (path: string, ...handlers: any[]) => { this.routerFor(path).put(path, ...handlers); };
  readonly delete = (path: string, ...handlers: any[]) => { this.routerFor(path).delete(path, ...handlers); };
  readonly patch = (path: string, ...handlers: any[]) => { this.routerFor(path).patch(path, ...handlers); };
  readonly use = (path: string, ...handlers: any[]) => { this.routerFor(path).use(path, ...handlers); };

  /** The middleware that hands a request to its plugin's routes, or on when no plugin owns its first segment. */
  readonly dispatch = (req: Request, res: Response, next: NextFunction): void => {
    const router = this.routers.get(PluginApiHost.firstSegment(req.path));
    if (!router) return next();
    router(req, res, next);
  };

  private routerFor(fullPath: string): express.Router {
    const slug = PluginApiHost.firstSegment(fullPath);
    let router = this.routers.get(slug);
    if (!router) {
      router = express.Router();
      this.routers.set(slug, router);
    }
    return router;
  }

  private static firstSegment(path: string): string {
    const end = path.indexOf('/', 1);
    return (end < 0 ? path.slice(1) : path.slice(1, end)).toLowerCase();
  }
}
