import { randomUUID } from 'crypto';
import { SitePreviewGrant } from '@core/tenant/preview/site-preview-grant';
import { SitePreviewGrantState } from '@core/enums/site-preview-grant-state.enum';
import { SitePreviewToken } from '@core/tenant/preview/site-preview-token';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The only writer of `_system_site_preview_grants`, and the only place a preview secret is created
 * or accepted.
 *
 * Keeping mint, spend and verify in one class is the point, the same way `CertificateStoreService`
 * keeps both sides of a private key together: a second path that minted a grant would be a second
 * path that could mint one without an expiry, and a second path that accepted a session would be a
 * second place to audit for "does this actually check the site?".
 *
 * WHAT A PREVIEW OPENS, AND WHAT IT DOES NOT. The answer this hands back is `true` to one question —
 * may this browser read a site that is not published yet. It is not an account, it grants no role,
 * and it does not open drafts: draft content is gated separately on a real session's permissions,
 * and nothing here touches that. A query parameter that granted preview by itself leaked drafts in
 * this codebase once; this is why the two are not the same mechanism.
 *
 * System table, so the raw manager and snake_case columns.
 */
export class SitePreviewGrantService {
  private static readonly TABLE = SystemConstants.TABLE.SITE_PREVIEW_GRANTS;

  /**
   * How long the one-time link is good for.
   *
   * A minute, because the link is not something an operator keeps — it is minted by a click and
   * followed by the browser in the same breath. Anything longer is a working preview link sitting in
   * a history entry or a chat message for no benefit to anybody.
   */
  static readonly GRANT_TTL_MS = 60_000;

  /**
   * How long the preview itself lasts before the operator asks again.
   *
   * Two hours: long enough to build and review a site without the page dying mid-edit, short enough
   * that a browser left open on a borrowed machine stops being a way in by the end of the day. NOT
   * operator-configurable yet — it is stated in the admin copy so it is at least visible, and making
   * it a declared setting belongs with the rest of the site's access settings.
   */
  static readonly SESSION_TTL_MS = 2 * 60 * 60 * 1000;

  constructor(private readonly db: any) {}

  /**
   * Mint a one-time grant for one site, on behalf of one account.
   *
   * Returns the raw token ONCE. It is not stored and cannot be recovered: if the caller loses it,
   * the answer is to mint another, not to look this one up.
   */
  async issue(tenantId: string, userId: string): Promise<string> {
    const site = String(tenantId ?? '').trim();
    const account = String(userId ?? '').trim();
    if (!site || !account) {
      throw new Error('SitePreviewGrantService.issue: a grant is always for one site and one account.');
    }

    const token = SitePreviewToken.mint();
    // BOUND TO THE SITE BEING PREVIEWED, not to the scope the operator is standing in. A preview is
    // minted from PLATFORM — the admin is looking at the list of sites, not standing inside one — so
    // `app.tenant_id` is empty and the row's own `WITH CHECK (tenant_id = current tenant)` refuses
    // it: minting failed with "new row violates row-level security policy" for every site. Naming
    // the tenant in the VALUES is not enough; the policy compares against the CONNECTION.
    await this.db.withTenant(site, () => this.db.insert(SitePreviewGrantService.TABLE, {
      id: randomUUID(),
      tenant_id: site,
      user_id: account,
      token_hash: SitePreviewToken.hash(token),
      expires_at: new Date(Date.now() + SitePreviewGrantService.GRANT_TTL_MS),
      state: String(SitePreviewGrantState.ISSUED.value),
      consumed_at: null,
      session_hash: null,
      session_expires_at: null,
    }));
    return token;
  }

  /**
   * Spend a grant on the site it was minted for, and get the session that replaces it.
   *
   * Returns the raw session token, or '' when the grant cannot be spent — expired, already spent, or
   * minted for a different site. The caller gets no reason, and deliberately: this is answered to
   * whoever arrived with the token in a URL, and telling them WHICH of those it was tells a stranger
   * something about a link they should not have.
   *
   * SINGLE USE, ENFORCED BY THE UPDATE ITSELF. The unspent state is part of the FILTER rather than
   * something checked first and written after, so two browsers following the same link race on the
   * database rather than on the gap in between; the loser gets no session.
   *
   * The filter compares a NOT NULL state, not `consumed_at IS NULL`. On the raw system-table path a
   * null in a WHERE becomes `= NULL`, which is true of nothing — so the null version matched zero
   * rows and refused every valid link, silently and identically to a real refusal. See
   * SitePreviewGrantState.
   */
  async exchange(rawToken: string, tenantId: string): Promise<string> {
    const hash = SitePreviewToken.hash(rawToken);
    if (!hash) return '';

    const row = await this.db.findOne(SitePreviewGrantService.TABLE, { token_hash: hash });
    if (!row) return '';

    const grant = SitePreviewGrant.from(row);
    if (!grant.isSpendable || !grant.isForTenant(tenantId)) return '';

    const session = SitePreviewToken.mint();
    const spent = await this.db.update(
      SitePreviewGrantService.TABLE,
      { id: grant.id, state: String(SitePreviewGrantState.ISSUED.value) },
      {
        state: String(SitePreviewGrantState.SPENT.value),
        consumed_at: new Date(),
        session_hash: SitePreviewToken.hash(session),
        session_expires_at: new Date(Date.now() + SitePreviewGrantService.SESSION_TTL_MS),
      },
    );
    // No row matched: something else spent this grant between the read above and here.
    if (!spent) return '';
    return session;
  }

  /**
   * Whether a session cookie still opens THIS site.
   *
   * The tenant is compared here, not by the caller. A session is for one site, and a check the
   * caller could forget is a check that is eventually forgotten — this one is on the path that
   * cannot be bypassed.
   */
  async verifySession(rawSession: unknown, tenantId: string): Promise<SitePreviewGrant | null> {
    const hash = SitePreviewToken.hash(rawSession);
    if (!hash) return null;

    const row = await this.db.findOne(SitePreviewGrantService.TABLE, { session_hash: hash });
    if (!row) return null;

    const grant = SitePreviewGrant.from(row);
    if (!grant.isSessionLive || !grant.isForTenant(tenantId)) return null;
    return grant;
  }

  /**
   * Drop what can no longer do anything: unspent grants past their minute, and spent ones whose
   * session has run out. Called by the sweep, so the table cannot grow without bound.
   */
  async prune(): Promise<number> {
    const rows: Array<Record<string, any>> = await this.db.find(SitePreviewGrantService.TABLE, {});
    const dead = (rows ?? [])
      .map((row) => SitePreviewGrant.from(row))
      .filter((grant) => !grant.isSpendable && !grant.isSessionLive);
    for (const grant of dead) {
      await this.db.delete(SitePreviewGrantService.TABLE, { id: grant.id });
    }
    return dead.length;
  }
}
