import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';

/**
 * Caches the "is this installation initialized?" answer, de-duplicating concurrent callers.
 *
 * Every part of it — the TTLs, the in-flight promise, the cached value and the cached error — lives on the
 * class as `private static`. None of it is module-level state: a loose `let` is invisible to the type
 * system's access rules, cannot be reset in a test, and gives the cache no name to be reasoned about.
 *
 * Two TTLs on purpose: a successful answer is cheap to re-fetch, while an error is re-tried far less often
 * so a down API is not hammered by every mount.
 */
export class InitializationStatusCache {
  private static readonly STATUS_TTL_MS = 5000;
  private static readonly ERROR_TTL_MS = 15000;

  private static inFlight: Promise<boolean> | null = null;
  private static value: boolean | null = null;
  private static expiresAt = 0;
  private static error: unknown = null;
  private static errorExpiresAt = 0;

  /** The cached answer, a re-thrown cached error, the in-flight request, or a fresh fetch — in that order. */
  static async get(): Promise<boolean> {
    const now = Date.now();

    if (InitializationStatusCache.value !== null && InitializationStatusCache.expiresAt > now) {
      return InitializationStatusCache.value;
    }

    if (InitializationStatusCache.error && InitializationStatusCache.errorExpiresAt > now) {
      throw InitializationStatusCache.error;
    }

    if (InitializationStatusCache.inFlight) {
      return InitializationStatusCache.inFlight;
    }

    InitializationStatusCache.inFlight = AdminApi.get(AdminConstants.ENDPOINTS.AUTH.STATUS)
      .then((data) => InitializationStatusCache.remember(data.initialized === true))
      .catch((error) => { throw InitializationStatusCache.rememberError(error); })
      .finally(() => { InitializationStatusCache.inFlight = null; });

    return InitializationStatusCache.inFlight;
  }

  private static remember(initialized: boolean): boolean {
    InitializationStatusCache.value = initialized;
    InitializationStatusCache.expiresAt = Date.now() + InitializationStatusCache.STATUS_TTL_MS;
    InitializationStatusCache.error = null;
    InitializationStatusCache.errorExpiresAt = 0;
    return initialized;
  }

  private static rememberError(error: unknown): unknown {
    InitializationStatusCache.error = error;
    InitializationStatusCache.errorExpiresAt = Date.now() + InitializationStatusCache.ERROR_TTL_MS;
    return error;
  }
}
