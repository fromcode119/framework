import { Enum } from '@fromcode119/react-class-components';

/**
 * The platform's answer when an edge asks whether it should serve — and buy a certificate for — a
 * hostname.
 *
 * Each member carries the HTTP status the internal endpoint answers with, so the mapping lives with
 * the meaning instead of in a switch at the route. The status IS the contract for an edge doing
 * on-demand TLS: a proxy asking at handshake time reads nothing but 2xx-or-not.
 */
export class HostPermissionVerdict extends Enum {
  /** One of ours, and live. Issue. */
  static readonly PERMITTED = new HostPermissionVerdict('permitted', 200);

  /** Not a host this platform serves. Never issue, and say nothing about what it does serve. */
  static readonly UNKNOWN = new HostPermissionVerdict('unknown_host', 404);

  /**
   * Ours, but the site is switched off.
   *
   * The one answer that differs from the routing map, deliberately: the map still ROUTES a suspended
   * tenant so the visitor gets a 503 explaining why, while the platform declines to spend or renew a
   * certificate on it.
   */
  static readonly SUSPENDED = new HostPermissionVerdict('tenant_suspended', 403);

  private constructor(value: string, readonly status: number) {
    super(value);
  }

  get isPermitted(): boolean {
    return this === HostPermissionVerdict.PERMITTED;
  }
}
