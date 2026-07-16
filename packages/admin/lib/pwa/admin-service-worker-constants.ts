import { ApiVersionUtils, RouteConstants } from '@fromcode119/core/client';

/**
 * Shared contract between the admin service worker (compiled to `public/sw.js`) and the client that
 * registers it. Both sides read these constants, so the script path and cache name can never drift apart.
 * Domain-agnostic — no plugin/appearance identity.
 */
export class AdminServiceWorkerConstants {
  /** Offline app-shell cache. Bump to invalidate the shell after a deploy. */
  static readonly SHELL_CACHE = 'admin-shell-v1';

  /** Public path the compiled worker is served from (emitted by the `build:sw` step). */
  static readonly SCRIPT_PATH = '/sw.js';

  /**
   * Path prefixes that must ALWAYS hit the network and are never cached — live API traffic and the
   * websocket upgrade. Sourced from the framework's own route constants so they cannot drift from the
   * paths the API actually serves. The API base is the DEFAULT rather than the env-resolved one on
   * purpose: the worker runs outside the app bundle with no `process.env`, and it matches against
   * same-origin request paths exactly as the browser sees them.
   */
  static readonly NETWORK_ONLY_PREFIXES: readonly string[] = [
    `${ApiVersionUtils.DEFAULT_API_BASE_PATH}/`,
    RouteConstants.SEGMENTS.WEBSOCKET,
  ];
}
