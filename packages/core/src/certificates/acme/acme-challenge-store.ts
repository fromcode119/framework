import { SystemConstants } from '@core/constants/system.constants';

/**
 * The tokens a certificate authority is about to ask for.
 *
 * NOTHING HERE IS SECRET. A key authorization is published to anyone who requests it — that is the
 * whole mechanism: the authority asks an unauthenticated question over plain HTTP and our answer
 * proves we control the host. So these rows are stored in the clear, deliberately, and the route
 * that serves them needs no authentication.
 *
 * They are short-lived. An order finishes in seconds and the token is useless afterwards, so the
 * sweep deletes what has expired rather than letting them accumulate for the life of the deployment.
 */
export class AcmeChallengeStore {
  private static readonly TABLE = SystemConstants.TABLE.ACME_CHALLENGES;
  /** Long enough for an order to complete and be retried once; short enough to be forgotten. */
  private static readonly LIFETIME_MS = 60 * 60 * 1000;

  constructor(private readonly db: any) {}

  /** Publish a token so the authority's request can be answered. */
  async put(token: string, host: string, keyAuthorization: string): Promise<void> {
    const expiresAt = new Date(Date.now() + AcmeChallengeStore.LIFETIME_MS);
    const existing = await this.db.findOne(AcmeChallengeStore.TABLE, { token });
    const payload = { host: String(host).toLowerCase(), key_authorization: keyAuthorization, expires_at: expiresAt };
    if (existing) {
      await this.db.update(AcmeChallengeStore.TABLE, { token }, payload);
      return;
    }
    await this.db.insert(AcmeChallengeStore.TABLE, { token, ...payload });
  }

  /**
   * The answer for a token, or '' when there is none.
   *
   * An EXPIRED row answers nothing. Serving one would tell an authority the host is ours long after
   * we stopped asking it to check, which is the one thing a challenge must never do.
   */
  async find(token: string): Promise<string> {
    const row = await this.db.findOne(AcmeChallengeStore.TABLE, { token: String(token ?? '') });
    if (!row) return '';
    const expiresAt = row.expires_at instanceof Date ? row.expires_at : new Date(String(row.expires_at));
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) return '';
    return String(row.key_authorization ?? '');
  }

  async remove(token: string): Promise<void> {
    await this.db.delete(AcmeChallengeStore.TABLE, { token: String(token ?? '') });
  }

  /** Drop what has expired. Called by the sweep, so the table cannot grow without bound. */
  async prune(): Promise<number> {
    const rows: Array<Record<string, any>> = await this.db.find(AcmeChallengeStore.TABLE, {});
    const stale = (rows ?? []).filter((row) => {
      const expiresAt = row.expires_at instanceof Date ? row.expires_at : new Date(String(row.expires_at));
      return Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now();
    });
    for (const row of stale) await this.remove(String(row.token));
    return stale.length;
  }
}
