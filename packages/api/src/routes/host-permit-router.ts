import express from 'express';
import { ApplicationUrlUtils, HostPermission, InternalServiceAuth, RouteConstants } from '@fromcode119/core';
import type { TenantRegistryService } from '@fromcode119/core';

/**
 * `GET /internal/hosts/permit?host=<name>` — "is this one of yours, and should it have a certificate?"
 *
 * The whole contract is the STATUS CODE: 200 yes, 404 not ours, 403 ours but switched off. That is
 * what a proxy doing on-demand TLS asks at handshake time before it orders a certificate for a name
 * it has never seen, and it is deliberately not in any proxy's configuration language — the edge can
 * be Caddy, nginx with `auth_request`, HAProxy with a Lua fetch, or a script. The framework states
 * the fact; it does not render somebody's config.
 *
 * AUTH, and why it is not the plain secret header the sibling routing endpoint uses: a proxy asking
 * during a TLS handshake cannot attach custom headers — Caddy's permission module sends a bare GET.
 * So this accepts the header when there is one, and otherwise only a caller on a private address.
 * Both paths require the secret to be CONFIGURED, so a deployment that never set one answers nothing
 * at all, exactly like the routing endpoint.
 *
 * It must never be published through the edge. Reachable from the internet it is a host-enumeration
 * oracle, and any party that can reach it can make the platform confirm names an attacker is probing.
 */
export class HostPermitRouter {
  readonly router = express.Router();

  /** RFC 1918 and loopback, v4 and v6. The networks a container-to-container call arrives on. */
  private static readonly PRIVATE = [
    /^127\./, /^::1$/, /^::ffff:127\./,
    /^10\./, /^::ffff:10\./,
    /^192\.168\./, /^::ffff:192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./, /^::ffff:172\.(1[6-9]|2\d|3[01])\./,
    /^f[cd][0-9a-f]{2}:/i,
  ];

  constructor(private readonly tenants: TenantRegistryService) {
    this.router.get(RouteConstants.SEGMENTS.INTERNAL_HOST_PERMIT, (req, res) => { void this.permit(req, res); });
  }

  private async permit(req: express.Request, res: express.Response): Promise<void> {
    // Never cached, anywhere. A cached "yes" outlives the removal of a domain and keeps renewing a
    // certificate for a host the platform no longer serves.
    res.setHeader('Cache-Control', 'no-store');

    if (!InternalServiceAuth.isConfigured() || !this.isInternal(req)) {
      res.status(401).json({ error: 'internal_only' });
      return;
    }

    const verdict = HostPermission.decide(req.query?.host, await this.tenants.list(), {
      admin: ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.ADMIN_APP),
      api: ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP),
      frontend: ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.FRONTEND_APP),
    });

    // The body never lists anything. A refusal says only that this name is not served — it must not
    // become a way to enumerate the platform's customers.
    res.status(verdict.status).json({ permitted: verdict.isPermitted, reason: String(verdict.value) });
  }

  /** The secret header if present, otherwise a caller on a private network. */
  private isInternal(req: express.Request): boolean {
    if (InternalServiceAuth.authorize(req.headers[InternalServiceAuth.HEADER])) return true;

    // `req.ip` honours `trust proxy`, which is what makes a forwarded address believable here. It is
    // also why this endpoint must not be routed through the edge: a public request arriving with a
    // spoofed forwarding header would otherwise read as private.
    const address = String(req.ip ?? '').trim();
    return address.length > 0 && HostPermitRouter.PRIVATE.some((pattern) => pattern.test(address));
  }
}
