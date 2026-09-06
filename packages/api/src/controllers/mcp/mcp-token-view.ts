import { RequestContextUtils, TenantMode } from '@fromcode119/core';

/**
 * Whose eyes a token-management call is made with: the site the admin session is bound to, and
 * whether that account is the platform admin.
 *
 * A site admin sees and revokes the tokens of THEIR site. The platform admin sees every token and is
 * the only one who may issue an all-sites token. In a single-tenant deployment there is one site and
 * every admin is the platform, so the view is `(null, true)` and nothing narrows.
 */
export class McpTokenView {
  constructor(readonly tenantId: string | null, readonly platformAdmin: boolean) {}

  static async for(req: any, memberships: { isPlatformAdminAccount(userId: string): Promise<boolean> }): Promise<McpTokenView> {
    if (!TenantMode.isEnabled()) return new McpTokenView(null, true);
    const tenantId = RequestContextUtils.getTenantId() ?? null;
    return new McpTokenView(tenantId, await memberships.isPlatformAdminAccount(String(req?.user?.id ?? '')));
  }

  /** Whether a token bound to `tokenTenantId` (null = all sites) is this viewer's to see or revoke. */
  sees(tokenTenantId: string | null): boolean {
    if (this.platformAdmin) return true;
    return tokenTenantId !== null && tokenTenantId === this.tenantId;
  }
}
