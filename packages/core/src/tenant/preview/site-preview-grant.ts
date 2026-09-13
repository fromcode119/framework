import { SitePreviewGrantState } from '@core/enums/site-preview-grant-state.enum';

/**
 * One operator's permission to look at one unpublished site.
 *
 * The row carries TWO secrets over its life and this class answers for both. The GRANT is minted in
 * the admin, lives for a minute and is spent once — it exists only to cross from one host to
 * another, which is the whole problem being solved. The SESSION replaces it on the site's own host
 * and is what every later request presents.
 *
 * Both are hashes here. Nothing on this class returns a usable secret, by construction, so "what
 * could hand out a preview" is the two `issue`/`open` methods on the service and nothing else.
 */
export class SitePreviewGrant {
  private constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly userId: string,
    readonly state: SitePreviewGrantState,
    readonly expiresAt: Date | null,
    readonly consumedAt: Date | null,
    readonly sessionExpiresAt: Date | null,
  ) {}

  /** Hydrate a raw system-table row. System tables are read through the raw manager, so snake_case. */
  static from(row: Record<string, any>): SitePreviewGrant {
    return new SitePreviewGrant(
      String(row?.id ?? ''),
      String(row?.tenant_id ?? ''),
      String(row?.user_id ?? ''),
      SitePreviewGrantState.find(row?.state) ?? SitePreviewGrantState.SPENT,
      SitePreviewGrant.readDate(row?.expires_at),
      SitePreviewGrant.readDate(row?.consumed_at),
      SitePreviewGrant.readDate(row?.session_expires_at),
    );
  }

  /**
   * Whether this grant can still be spent: never spent before, and not yet lapsed.
   *
   * A grant with no expiry is NOT spendable, and neither is one whose state cannot be read — `from`
   * resolves an unreadable state to SPENT. A row nobody can reason about is a row that does nothing:
   * the safe reading of "I don't know whether this still works" is "it does not".
   */
  get isSpendable(): boolean {
    if (this.state !== SitePreviewGrantState.ISSUED) return false;
    if (!this.expiresAt) return false;
    return this.expiresAt.getTime() > Date.now();
  }

  /** Whether the session this grant was exchanged for is still live. Same reading of a missing date. */
  get isSessionLive(): boolean {
    if (!this.sessionExpiresAt) return false;
    return this.sessionExpiresAt.getTime() > Date.now();
  }

  /** Whether this grant is about THIS site. Compared on every read; a grant is never site-agnostic. */
  isForTenant(tenantId: unknown): boolean {
    const wanted = String(tenantId ?? '').trim();
    return wanted.length > 0 && wanted === this.tenantId;
  }

  private static readDate(raw: unknown): Date | null {
    if (!raw) return null;
    const parsed = raw instanceof Date ? raw : new Date(String(raw));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
