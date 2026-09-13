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
 * TWO THINGS ARE EXEMPT, and both are load-bearing.
 *
 * `/.well-known/acme-challenge/` must be served over PLAIN HTTP, because it is how a certificate
 * authority proves the host is ours BEFORE a certificate exists to redirect to. Redirecting it to
 * HTTPS fails validation every time, and each failure spends part of a budget of five per hostname
 * per hour.
 *
 * A request that already arrived over HTTPS somewhere in front of us — `x-forwarded-proto: https` —
 * must not be redirected either. When an edge terminates TLS and forwards to this plain port, every
 * such request would otherwise be told to go to HTTPS, where it would be terminated and forwarded
 * here again: an infinite loop on every host the moment TLS termination is switched on.
 */
export class GatewayPlainListenerPolicy {
  /** Fixed by the ACME protocol; not ours to choose. */
  static readonly CHALLENGE_PREFIX = '/.well-known/acme-challenge/';

  constructor(private readonly terminatesTls: boolean) {}

  /**
   * The HTTPS address to send this request to, or null to handle it normally.
   *
   * A request with no Host cannot be redirected anywhere meaningful, so it is handled normally and
   * refused further down like any other unknown host.
   */
  redirectFor(req: http.IncomingMessage): string | null {
    if (!this.terminatesTls) return null;

    // Already secure in front of us. Redirecting would send it back around the same loop forever.
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
    if (forwardedProto === 'https') return null;

    // The one path that must answer over plain HTTP, because it is what makes HTTPS possible.
    if (GatewayPlainListenerPolicy.isChallengePath(req.url || '/')) return null;

    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    if (!host) return null;

    return `https://${host.replace(/:\d+$/, '')}${req.url || '/'}`;
  }

  /** Whether this is a certificate authority asking us to prove we own the host. */
  static isChallengePath(url: string): boolean {
    return String(url || '').startsWith(GatewayPlainListenerPolicy.CHALLENGE_PREFIX);
  }
}
