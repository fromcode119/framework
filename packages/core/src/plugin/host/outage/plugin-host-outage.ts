import type { Request, Response, NextFunction } from 'express';
import { PluginGuestHttp } from '@core/plugin/host/plugin-guest-http';

/**
 * What a request meets while a plugin's process is not running — crashed and restarting, or gone with
 * the `extension-host` container.
 *
 * A plugin's MIDDLEWARE runs on every api request, not only on the plugin's own, so forwarding to a
 * process that is not there failed EVERY request the api served: the admin's sign-in check, every other
 * plugin's pages, the sites. The platform must keep working without a plugin. So while the process is
 * down, its middleware steps aside for everything that is not the plugin's — and still refuses the
 * plugin's own collections, with the reason, because the checks it would have made on those (a feature
 * switched off, a gate) cannot be made without it. The plugin's own routes reach this through their
 * route stand-ins and are refused the same way.
 *
 * Not "anything under `/plugins/<slug>`": the platform's own endpoints for managing a plugin live there
 * too (its detail, settings, process), and must answer most of all while the plugin is down.
 */
export class PluginHostOutage {
  static readonly STATUS = 503;

  constructor(
    private readonly slug: string,
    /** The collection slugs this plugin registered — physical and short. */
    private readonly collections: () => Iterable<string>,
    /** Why the process is not running, for the refusal. */
    private readonly reason: () => string,
  ) {}

  /** Handles a request for a plugin whose process is not running. */
  handle(req: Request, res: Response, next: NextFunction, targetPath: string | undefined): void {
    const middleware = String(targetPath ?? '').startsWith(PluginGuestHttp.MIDDLEWARE_PATH);
    if (middleware && !this.owns(String(req.originalUrl ?? req.url ?? ''))) {
      next();
      return;
    }
    res.status(PluginHostOutage.STATUS).json({ error: `Plugin "${this.slug}" is not running: ${this.reason()}` });
  }

  /** Whether `url` is one of this plugin's collections. */
  owns(url: string): boolean {
    const path = url.split('?')[0];
    for (const collection of this.collections()) if (PluginHostOutage.hasSegment(path, 'collections', collection)) return true;
    return false;
  }

  /** `…/<parent>/<name>` followed by `/` or the end — `wallets` does not own `wallets-archive`. */
  private static hasSegment(path: string, parent: string, name: string): boolean {
    const marker = `/${parent}/${name}`;
    for (let index = path.indexOf(marker); index >= 0; index = path.indexOf(marker, index + 1)) {
      const after = path.charAt(index + marker.length);
      if (after === '' || after === '/') return true;
    }
    return false;
  }
}
