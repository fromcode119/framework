import { CoercionUtils } from '@fromcode119/core';

/**
 * One MCP token as the api reasons about it: who owns it, what it may reach, and WHICH SITE it acts on.
 *
 * `tenantId` is the site the token is bound to. `null` means ALL SITES — a platform token, which must
 * name its site per request (`McpWirePaths.SITE_HEADER`). In a single-tenant deployment every token
 * is `null` and the distinction never surfaces.
 *
 * `legacy` marks a token issued before tokens carried a site: its row lives in the partition of the
 * site whose admin issued it, and that partition IS its binding. Such tokens keep working, bound to
 * that site, without anyone re-issuing them.
 */
export class McpTokenRecord {
  constructor(
    readonly tokenId: string,
    readonly userId: number,
    readonly label: string,
    readonly scopes: string[] | undefined,
    readonly expiresAt: string | null,
    readonly tenantId: string | null,
    readonly legacy: boolean,
  ) {}

  /** `null` when the row is not a token row we can trust: no user, no token id, unparsable. */
  static fromRow(row: { value?: unknown } | null | undefined, partitionTenantId: string | null, legacy: boolean): McpTokenRecord | null {
    if (!row?.value) return null;
    let payload: any;
    try { payload = JSON.parse(String(row.value)); } catch { return null; }
    const userId = Number(payload?.userId || 0);
    const tokenId = CoercionUtils.toString(payload?.tokenId).trim();
    if (!userId || !tokenId) return null;
    // NOT filtered: `McpTokenScopeMatcher` distinguishes "no list" (unrestricted) from "a list that
    // narrows to nothing usable" (deny). Dropping blanks here would collapse the second into the first.
    const scopes = Array.isArray(payload?.scopes) ? payload.scopes.map((s: unknown) => String(s ?? '')) : undefined;
    const stored = CoercionUtils.toString(payload?.tenantId).trim();
    return new McpTokenRecord(
      tokenId,
      userId,
      CoercionUtils.toString(payload?.label),
      scopes,
      payload?.expiresAt ? CoercionUtils.toString(payload.expiresAt) : null,
      legacy ? partitionTenantId : (stored || null),
      legacy,
    );
  }

  get isExpired(): boolean {
    if (!this.expiresAt) return false;
    const at = new Date(this.expiresAt).getTime();
    return !Number.isNaN(at) && at < Date.now();
  }

  /** A platform token: valid for every site, and must name one per request. */
  get allSites(): boolean {
    return this.tenantId === null;
  }
}
