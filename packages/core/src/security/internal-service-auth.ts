import { EnvUtils } from '@core/utils/env-utils';

/**
 * The shared secret one Fromcode app presents when it calls another one directly — api → admin,
 * api → frontend. Server-to-server only.
 *
 * A session cookie is the wrong credential here: the caller is a process, not a person, and the admin
 * and frontend apps do not have the api's user database in front of them. So the operator's permission
 * is checked ONCE, by the api, against the real RBAC permission; what crosses the wire afterwards is
 * this secret, which proves only "this request came from inside the deployment".
 *
 * It fails CLOSED. With `INTERNAL_SERVICE_SECRET` unset, {@link authorize} rejects everything — an
 * unconfigured install exposes no restart endpoint at all, rather than one anybody can call. That is
 * also why the comparison below is constant-time: the endpoints it guards are reachable from wherever
 * the app itself is reachable.
 */
export class InternalServiceAuth {
  /** Header the calling app sets and the receiving app verifies. */
  static readonly HEADER = 'x-fromcode-internal-secret';

  /** The single env var that configures it. Same value in every app of one deployment. */
  static readonly ENV_KEY = 'INTERNAL_SERVICE_SECRET';

  static secret(): string {
    return EnvUtils.text(InternalServiceAuth.ENV_KEY).trim();
  }

  /** False when the deployment has no secret — callers must say so rather than proceeding. */
  static isConfigured(): boolean {
    return InternalServiceAuth.secret().length > 0;
  }

  /** The header a caller sends. Empty when unconfigured, so the receiver rejects it. */
  static requestHeaders(): Record<string, string> {
    return { [InternalServiceAuth.HEADER]: InternalServiceAuth.secret() };
  }

  /**
   * Verify a presented secret against the configured one, in time that does not depend on how many
   * leading characters matched. `node:crypto` is deliberately not used: this class is imported by the
   * admin and frontend Next apps, whose module graph reaches the browser build.
   */
  static authorize(presented: unknown): boolean {
    const expected = InternalServiceAuth.secret();
    if (!expected) return false;

    const provided = String(presented ?? '');
    if (provided.length !== expected.length) return false;

    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) {
      difference |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
    }
    return difference === 0;
  }
}
