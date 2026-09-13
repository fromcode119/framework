import http from 'http';

/**
 * What the plain-HTTP listener does once this gateway is the thing terminating TLS.
 *
 * It stops being a way into the platform and becomes a signpost: everything is redirected to HTTPS.
 * Before TLS termination is switched on it must keep proxying exactly as it always has, because
 * something else is terminating TLS in front of it and every request arrives here over plain HTTP by
 * design — redirecting those would loop forever.
 *
 * So the whole policy is one question: is THIS process holding the certificates?
 *
 * `/.well-known/acme-challenge/` is deliberately NOT special-cased here. Nothing issues certificates
 * yet, so a branch forwarding that path would forward to a route that does not exist. It belongs
 * with the issuing work, in the same change that creates something to forward to.
 */
export class GatewayPlainListenerPolicy {
  constructor(private readonly terminatesTls: boolean) {}

  /**
   * The HTTPS address to send this request to, or null to handle it normally.
   *
   * A request with no Host cannot be redirected anywhere meaningful, so it is handled normally and
   * refused further down like any other unknown host.
   */
  redirectFor(req: http.IncomingMessage): string | null {
    if (!this.terminatesTls) return null;

    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    if (!host) return null;

    return `https://${host.replace(/:\d+$/, '')}${req.url || '/'}`;
  }
}
