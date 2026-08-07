import { NetworkAddressUtils } from '@fromcode119/core';
import { AdminBootstrapRateLimitUtils } from '@api/utils/admin-bootstrap-rate-limit-utils';
import { RateLimitSettingsUtils } from '@api/utils/rate-limit-settings-utils';
import type { IRateLimitRequest } from '@api/utils/interfaces/rate-limit-request.interface';

/**
 * The single place that answers "which bucket does this request count against, and how big is it?".
 *
 * Both live limiters asked those two questions side by side, so a new bucket had to be added twice or
 * the two would disagree about which budget a request was spending. They now call in here.
 *
 * The bucket order is deliberate — the earlier a rule matches, the more specific the bucket:
 *   1. admin bootstrap group (per ip + screen), 2. token bearer (per ip + token),
 *   3. internal service caller (per calling service address), 4. anonymous (per IP).
 *
 * Rule 3 is what stops the storefront throttling itself. Every server-side page render fetches this
 * API from ONE frontend container with no visitor identity, so ALL anonymous SSR traffic for ALL
 * visitors was counted into the single strict anonymous IP bucket: under ordinary crawler load
 * `/system/resolve` started answering 429, and a page-existence resolver that cannot answer can only
 * be served as a 5xx. The renderer now spends its own declared budget instead.
 */
export class RateLimitBucketUtils {
  /** The limiter key this request counts against. */
  static resolveKey(requestLike: IRateLimitRequest, settingsCache?: Map<string, string>): string {
    if (RateLimitBucketUtils.isInternalServiceRequest(requestLike, settingsCache)) {
      return `internal:${RateLimitBucketUtils.resolveClientAddress(requestLike)}`;
    }
    return AdminBootstrapRateLimitUtils.resolveKey(requestLike);
  }

  /** The operator's configured budget for the bucket this request counts against. */
  static resolveLimit(requestLike: IRateLimitRequest, settingsCache?: Map<string, string>): number {
    if (RateLimitBucketUtils.isInternalServiceRequest(requestLike, settingsCache)) {
      return RateLimitSettingsUtils.resolveMaxRequestsInternal(settingsCache);
    }
    return RateLimitSettingsUtils.resolveMaxRequests(
      AdminBootstrapRateLimitUtils.hasAuthToken(requestLike),
      settingsCache,
    );
  }

  /**
   * True when this is a server-to-server call from an address the operator declared internal.
   *
   * Recognition is by ADDRESS, never by a header: a header saying "I am the renderer" is something
   * any public client can send, and the reward here is a much larger budget. Both the direct socket
   * peer AND the resolved client address must be on the allowlist. Requiring the peer stops the edge
   * proxy — which also sits on a private address — from laundering public visitors into this bucket,
   * since their resolved address is their own public one; requiring the resolved address keeps the
   * bucket working when SSR is routed through that same proxy rather than straight to the container.
   * (In development `trust proxy` accepts every hop, so a local client can claim an internal address.
   * It buys a rate-limit budget and nothing else, and the allowlist is the operator's to empty.)
   *
   * Only ANONYMOUS traffic qualifies. A token-bearing request — including a server render carrying a
   * signed-in visitor's forwarded cookie — already has its own per ip+token bucket, and an admin
   * browsing from inside the private network must not silently share the renderer's budget.
   */
  static isInternalServiceRequest(requestLike: IRateLimitRequest, settingsCache?: Map<string, string>): boolean {
    if (AdminBootstrapRateLimitUtils.hasAuthToken(requestLike)) return false;
    if (AdminBootstrapRateLimitUtils.isAdminBootstrapRead(requestLike)) return false;

    const allowedClients = RateLimitSettingsUtils.resolveInternalClients(settingsCache);
    if (allowedClients.length === 0) return false;

    return NetworkAddressUtils.matchesAny(RateLimitBucketUtils.resolvePeerAddress(requestLike), allowedClients)
      && NetworkAddressUtils.matchesAny(RateLimitBucketUtils.resolveClientAddress(requestLike), allowedClients);
  }

  /** The address the proxy chain resolved this request to (Express `req.ip`). */
  private static resolveClientAddress(requestLike: IRateLimitRequest): string {
    return NetworkAddressUtils.normalize(requestLike.ip);
  }

  /** The address at the other end of the TCP socket — the one hop nothing can forge a header for. */
  private static resolvePeerAddress(requestLike: IRateLimitRequest): string {
    return NetworkAddressUtils.normalize(requestLike.socket?.remoteAddress);
  }
}
