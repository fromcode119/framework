import fs from 'fs';
import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import { RequestContextUtils } from '@core/context/request-context';
import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';
import { PluginGuestConnections } from '@core/plugin/host/connections/plugin-guest-connections';
import type { PluginChannel } from '@core/plugin/host/plugin-channel';

/**
 * The guest's own Express app, served on a Unix socket the host proxies to.
 *
 * Plugin routers run here UNCHANGED — real `req`/`res`, streaming, multer, everything Express gives
 * them — which is the reason routes cross as HTTP and not as messages. The host has already
 * authenticated the request: it forwards the user it established as `x-fc-user`, and the invocation
 * token / tenant / locale as `x-fc-*` headers; the first middleware here turns those into the guest's
 * request context and strips them, so plugin code sees an ordinary request.
 *
 * Guards are local: `context.auth.guard(roles)` checks the forwarded user's roles;
 * `requirePermission` asks the host for the user's permissions (one call, cached per request).
 */
export class PluginGuestHttp {
  static readonly HEADER_TOKEN = 'x-fc-token';
  static readonly HEADER_TENANT = 'x-fc-tenant';
  static readonly HEADER_SITE_LOCALE = 'x-fc-site-locale';
  static readonly HEADER_LOCALE = 'x-fc-locale';
  static readonly HEADER_USER = 'x-fc-user';

  /**
   * The forwarded user, base64 as written by the host — see {@link encodeUser}. A value that is not
   * base64 is read as plain JSON, so a guest started before the host still understands it.
   */
  static decodeUser(raw: string): unknown {
    const attempts = [
      () => JSON.parse(Buffer.from(raw, 'base64').toString('utf8')),
      () => JSON.parse(raw),
    ];
    for (const attempt of attempts) {
      try { return attempt(); } catch { /* try the next shape */ }
    }
    return undefined;
  }

  /**
   * The user, as an HTTP header value.
   *
   * A header carries ISO-8859-1: Node REFUSES to write a value with any character outside it, and the
   * whole request dies with "Invalid character in header content". The user object carries a person's
   * NAME, so every plugin route proxied to an isolated guest answered 500 for anyone called Кристиян —
   * a platform whose first market writes Cyrillic, where that is most accounts. Base64 of the UTF-8
   * JSON is always header-safe.
   */
  static encodeUser(user: unknown): string {
    if (!user) return '';
    return Buffer.from(JSON.stringify(user), 'utf8').toString('base64');
  }

  static readonly HEADER_ORIGINAL_URL = 'x-fc-original-url';
  static readonly HEADER_NEXT = 'x-fc-next';
  /** Set by the host when it forwarded the request's ORIGINAL bytes (a webhook): the guest keeps them as `req.rawBody`. */
  static readonly HEADER_RAW_BODY = 'x-fc-raw-body';
  static readonly MIDDLEWARE_PATH = '/__fc/middleware';

  readonly app: Express;
  private server: ReturnType<Express['listen']> | null = null;

  constructor(
    private readonly socketPath: string,
    private readonly remote: PluginGuestRemote,
    private readonly socketMode = 0o600,
    /** The api connection a request came from — named by `x-fc-connection`; the process's first when absent. */
    private readonly channelFor: (connectionId: string | null) => PluginChannel | undefined = () => undefined,
  ) {
    this.app = express();
    this.app.disable('x-powered-by');
    this.app.use(this.enterInvocation.bind(this));
    this.app.use(express.json({ limit: '25mb', verify: PluginGuestHttp.keepRawBody }));
    this.app.use(express.urlencoded({ extended: true, limit: '25mb', verify: PluginGuestHttp.keepRawBody }));
  }

  async listen(): Promise<void> {
    if (fs.existsSync(this.socketPath)) fs.rmSync(this.socketPath, { force: true });
    await new Promise<void>((resolve, reject) => {
      this.server = this.app.listen(this.socketPath, () => resolve());
      this.server.on('error', reject);
    });
    fs.chmodSync(this.socketPath, this.socketMode);
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
    if (fs.existsSync(this.socketPath)) fs.rmSync(this.socketPath, { force: true });
  }

  /**
   * A webhook's signature is over the exact bytes; the host forwards them untouched and flags it, so the
   * plugin's verifier reads `req.rawBody` here exactly as it would on the host. Both body parsers keep
   * them: a provider that posts a FORM (myPOS) signs its bytes just as a JSON one (Stripe) does.
   */
  static keepRawBody(req: any, _res: unknown, buf: Buffer, encoding: string): void {
    if (!req.fcKeepRawBody) return;
    req.rawBody = Buffer.from(buf);
    req.rawBodyString = buf.toString((encoding as BufferEncoding) || 'utf8');
  }

  /** A global middleware the plugin registered: mounted under a private path the host targets by id. */
  mountMiddleware(id: string, handler: (req: any, res: any, next: (err?: any) => void) => void): void {
    this.app.all(`${PluginGuestHttp.MIDDLEWARE_PATH}/${encodeURIComponent(id)}`, (req: Request, res: Response) => {
      const original = String(req.headers[PluginGuestHttp.HEADER_ORIGINAL_URL] ?? '/');
      (req as any).url = original;
      (req as any).originalUrl = original;
      handler(req, res, (err?: unknown) => {
        if (res.headersSent) return;
        if (err) {
          res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
          return;
        }
        res.setHeader(PluginGuestHttp.HEADER_NEXT, '1');
        res.status(204).end();
      });
    });
  }

  /** `context.auth.guard(roles)` — the host authenticated; the guest authorises on what it forwarded. */
  static guard(roles: string[] = []): (req: any, res: any, next: NextFunction) => void {
    return (req, res, next) => {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
        return;
      }
      if (roles.length > 0) {
        const held: string[] = Array.isArray(req.user.roles) ? req.user.roles : [];
        if (!roles.some((role) => held.includes(role))) {
          res.status(403).json({ error: 'Forbidden: insufficient permissions' });
          return;
        }
      }
      next();
    };
  }

  static platformGuard(): (req: any, res: any, next: NextFunction) => void {
    return (req, res, next) => {
      const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
        return;
      }
      if (!roles.includes('admin') || (req.user.multiTenant === true && req.user.platformAdmin !== true)) {
        res.status(403).json({ error: 'platform_admin_required' });
        return;
      }
      next();
    };
  }

  requirePermission(permission: string | string[]): (req: any, res: any, next: NextFunction) => Promise<void> {
    const required = Array.isArray(permission) ? permission : [permission];
    return async (req, res, next) => {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
        return;
      }
      try {
        const permissions = (await this.remote.call('context', [{ name: 'auth' }, { name: 'getUserPermissions', args: [req.user.id] }])) as string[];
        const granted = Array.isArray(permissions) ? permissions.map(String) : [];
        if (granted.includes('*') || required.every((entry) => granted.includes(entry))) {
          next();
          return;
        }
        res.status(403).json({ error: 'Forbidden: insufficient permissions', required });
      } catch (error) {
        res.status(503).json({ error: 'permission check unavailable', detail: error instanceof Error ? error.message : String(error) });
      }
    };
  }

  private enterInvocation(req: Request, _res: Response, next: NextFunction): void {
    // Read before the private headers are stripped below; the body parsers (which run after this) check it.
    (req as any).fcKeepRawBody = Boolean(req.headers[PluginGuestHttp.HEADER_RAW_BODY]);
    const token = String(req.headers[PluginGuestHttp.HEADER_TOKEN] ?? '');
    const tenantId = String(req.headers[PluginGuestHttp.HEADER_TENANT] ?? '').trim() || null;
    const locale = String(req.headers[PluginGuestHttp.HEADER_LOCALE] ?? '');
    const siteLocale = String(req.headers[PluginGuestHttp.HEADER_SITE_LOCALE] ?? '').trim() || undefined;
    const connectionId = String(req.headers[PluginGuestConnections.HEADER_CONNECTION] ?? '').trim() || null;
    const rawUser = req.headers[PluginGuestHttp.HEADER_USER];
    if (typeof rawUser === 'string' && rawUser) {
      (req as any).user = PluginGuestHttp.decodeUser(rawUser);
    }
    for (const header of [PluginGuestHttp.HEADER_TOKEN, PluginGuestHttp.HEADER_TENANT, PluginGuestHttp.HEADER_LOCALE, PluginGuestHttp.HEADER_SITE_LOCALE, PluginGuestHttp.HEADER_USER, PluginGuestHttp.HEADER_RAW_BODY, PluginGuestConnections.HEADER_CONNECTION]) {
      delete req.headers[header];
    }
    (req as any).tenantId = tenantId ?? undefined;
    PluginGuestRemote.invocation.run({ token, tenantId, channel: this.channelFor(connectionId) }, () => {
      RequestContextUtils.storage.run({ locale, tenantId: tenantId ?? undefined, siteLocale }, () => next());
    });
  }
}
