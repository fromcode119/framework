import express from 'express';
import { CertificateStoreService, InternalServiceAuth, RouteConstants } from '@fromcode119/core';

/**
 * `GET /internal/certificates` — the certificates and PRIVATE KEYS whatever terminates TLS loads.
 *
 * This is the only route in the platform that returns key material, so it carries the strictest
 * rules here and nowhere else:
 *
 * - SECRET ONLY. Not the private-address fallback the permit endpoint allows — that exists because a
 *   proxy asking during a TLS handshake cannot attach headers, which does not apply to a terminator
 *   loading its certificates at start. A caller that cannot send the header has no business with a
 *   private key.
 * - NEVER PUBLISHED THROUGH THE EDGE. Reachable from the internet this is not an information leak,
 *   it is the private keys of every site on the platform.
 * - NEVER CACHED. A cached key outlives the removal of a certificate, and revoking something a cache
 *   still holds is not revoking it.
 *
 * No secret configured → the route answers nothing at all, exactly like the routing map, so a
 * deployment that never set one exposes nothing rather than exposing everything.
 */
export class CertificatesInternalRouter {
  readonly router = express.Router();

  constructor(private readonly certificates: CertificateStoreService) {
    this.router.get(RouteConstants.SEGMENTS.INTERNAL_CERTIFICATES, (req, res) => { void this.bundle(req, res); });
  }

  private async bundle(req: express.Request, res: express.Response): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');

    if (!InternalServiceAuth.isConfigured() || !InternalServiceAuth.authorize(req.headers[InternalServiceAuth.HEADER])) {
      res.status(401).json({ error: 'internal_secret_required' });
      return;
    }

    const certificates = await this.certificates.edgeBundle();
    res.json({ certificates, generatedAt: new Date().toISOString() });
  }
}
