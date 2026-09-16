import * as path from 'path';
import express from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Logger, ProjectPaths, SystemConstants, TenantMode, TenantResolverService } from '@fromcode119/core';
import { RequestTenantService } from '@api/services/request/request-tenant-service';

/**
 * Serving `/uploads` for the site the request is actually for.
 *
 * TWO handlers, in order, and the order is the whole design:
 *
 *   1. THIS SITE's own directory. Everything uploaded since sites had one lands here, so this is the
 *      answer for anything current, and one site's request can never reach another's subtree.
 *   2. The shared parent, for files written BEFORE sites had their own directories. Those sit flat in
 *      the root and there is no record of who uploaded them — the media table accounts for well under
 *      a fifth of what is on disk, and the rest are variants, exports and artifacts with no row at
 *      all. Resolving reads to the per-site directory alone would therefore 404 the overwhelming
 *      majority of existing images, which is the one failure this codebase has already had.
 *
 * So nothing moves and nothing breaks: new files are isolated by where they are written, and old ones
 * keep resolving exactly as they did. The fallback cannot become a hole for new uploads, because new
 * uploads are not in the shared parent to be found.
 *
 * WHY THE TENANT IS RESOLVED HERE rather than read from the request context: this mount is registered
 * before the middleware that binds it, deliberately — static files are served without cookies, CSRF,
 * auth or the rate limiter — so at this point nothing has bound a site yet. The host is the same
 * signal that middleware uses, through the same resolver and its cached host map.
 */
export class TenantUploadsStatic {
  private static readonly logger = new Logger({ namespace: 'uploads-static' });

  /** One `express.static` per directory, because building one per request would be absurd. */
  private readonly handlers = new Map<string, RequestHandler>();

  constructor(
    private readonly database: unknown,
    private readonly options: Parameters<typeof express.static>[1],
  ) {}

  /** The pair of handlers to mount, tenant-first. */
  middleware(): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const root = ProjectPaths.getUploadsRoot();
      const tenantDir = await this.tenantDirFor(req, root);

      // The shared parent always runs last, so a file that predates per-site directories still
      // resolves. `express.static` calls `next()` when it finds nothing, which is what chains these.
      const chain = tenantDir ? [this.staticFor(tenantDir), this.staticFor(root)] : [this.staticFor(root)];
      this.run(chain, req, res, next);
    };
  }

  /** Runs the handlers in order, falling through to `next` when none of them served the file. */
  private run(chain: RequestHandler[], req: Request, res: Response, next: NextFunction): void {
    const step = (index: number): void => {
      if (index >= chain.length) return next();
      chain[index](req, res, () => step(index + 1));
    };
    step(0);
  }

  private staticFor(directory: string): RequestHandler {
    const existing = this.handlers.get(directory);
    if (existing) return existing;
    const handler = express.static(directory, this.options);
    this.handlers.set(directory, handler);
    return handler;
  }

  /**
   * The requesting site's own uploads directory, or null when there is none to use.
   *
   * Null on a single-site deployment (there is one directory and it is the root), and null for a host
   * that names no site — an unknown host gets the shared parent, which is what it got before this
   * existed, rather than a directory built from an unvalidated name.
   */
  private async tenantDirFor(req: Request, root: string): Promise<string | null> {
    if (!TenantMode.isEnabled() || !this.database) return null;

    const host = RequestTenantService.hostFrom(req);
    if (!host) return null;

    try {
      const tenant = await TenantResolverService.shared(this.database).resolveByHost(host);
      const id = String(tenant?.id ?? '').trim();
      if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
      return path.join(root, SystemConstants.STORAGE.TENANTS_SUBDIR, id);
    } catch (error: unknown) {
      // Serving the shared parent is what every request got before this existed, so a failed lookup
      // degrades to the old behaviour rather than to a broken image.
      TenantUploadsStatic.logger.warn(
        `Could not resolve the site for an uploads request on "${host}". `
        + `${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
