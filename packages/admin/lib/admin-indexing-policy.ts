import { ApplicationUrlUtils } from '@fromcode119/sdk';

/**
 * Whether crawlers may index this console.
 *
 * The admin said nothing to a crawler at all: no `robots.txt`, no `X-Robots-Tag`, no meta. It was
 * indexable by omission rather than by decision — and its login page names the platform and the
 * customer, while its URL structure describes the installation.
 *
 * The answer is an operator setting (Settings → General), read from the one PUBLIC endpoint the
 * admin already asks for before anyone signs in. It has to be public: the requests that need the
 * answer — `robots.txt`, and every response that carries the header — have no session, so a setting
 * behind auth could not be read by them.
 *
 * Cached briefly and FAIL-CLOSED: when the api cannot be reached the answer is "do not index",
 * because the failure mode of guessing wrong in the other direction is a console in a search index,
 * which no later correction removes.
 */
export class AdminIndexingPolicy {
  private static readonly TTL_MS = 60_000;
  private static cachedAt = 0;
  private static cached = false;

  static async allowed(): Promise<boolean> {
    const now = Date.now();
    if (now - AdminIndexingPolicy.cachedAt < AdminIndexingPolicy.TTL_MS) {
      return AdminIndexingPolicy.cached;
    }

    try {
      const response = await fetch(AdminIndexingPolicy.hostEndpoint(), {
        headers: { accept: 'application/json' },
      });
      if (!response.ok) return AdminIndexingPolicy.remember(false);
      const body = await response.json() as { searchIndexing?: unknown };
      return AdminIndexingPolicy.remember(body?.searchIndexing === true);
    } catch {
      return AdminIndexingPolicy.remember(false);
    }
  }

  /**
   * The last known answer, without waiting — for the auth gate, which is synchronous and is not
   * worth making async for a response header.
   *
   * Safe because the default is the SAFE one: before any answer has arrived this reads "refuse", and
   * a refresh is kicked off for the next request. A header that is briefly too strict costs nothing;
   * one that is briefly too permissive puts a console in an index.
   */
  static refusedSynchronously(): boolean {
    if (Date.now() - AdminIndexingPolicy.cachedAt >= AdminIndexingPolicy.TTL_MS) {
      // Fire and forget: this request answers from what is known now, the next one is accurate.
      void AdminIndexingPolicy.allowed().catch(() => undefined);
    }
    return !AdminIndexingPolicy.cached;
  }

  /**
   * Where to ask, from inside the admin's own process.
   *
   * `API_URL` first: it is the in-cluster address, so this never leaves the network or pays for TLS,
   * and it keeps working when the public hostname does not resolve from inside the container.
   *
   * The `/api` segment is not optional — the api mounts its versioned routes under it. Asking for
   * `<base>/v1/auth/host` returns the 404 page, which this class reads as "cannot tell" and answers
   * by refusing, so the setting looked dead while being read perfectly.
   */
  private static hostEndpoint(): string {
    const base = String(process.env.API_URL || '').trim()
      || ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP);
    return ApplicationUrlUtils.joinApiPath(base.replace(/\/+$/, ''), 'api/v1/auth/host');
  }

  private static remember(allowed: boolean): boolean {
    AdminIndexingPolicy.cached = allowed;
    AdminIndexingPolicy.cachedAt = Date.now();
    return allowed;
  }

  /** What the `X-Robots-Tag` header says when indexing is refused. */
  static readonly REFUSE = 'noindex, nofollow, noarchive';
}
