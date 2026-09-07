import { CoercionUtils, TenantMode } from '@fromcode119/core';
import { McpTokenService } from '@api/controllers/mcp/mcp-token-service';
import { McpTokenView } from '@api/controllers/mcp/mcp-token-view';

/**
 * Admin-facing token management.
 *
 * `createToken`'s response is the ONLY place a raw key ever appears; every other endpoint returns
 * summaries that cannot contain one. These routes are guarded by an admin SESSION, not a token — a
 * token must not be able to mint another token, or a narrowly scoped one could escalate itself by
 * issuing a wider sibling.
 *
 * A token is bound to the SITE the issuing session is in. Only the platform admin may issue an
 * all-sites token (`site: "all"`), and a site admin sees and revokes only their own site's tokens.
 */
export class McpTokenController {
  static readonly ALL_SITES = 'all';

  constructor(
    private readonly tokens: McpTokenService,
    private readonly memberships: { isPlatformAdminAccount(userId: string): Promise<boolean> },
  ) {}

  async listTokens(req: any, res: any): Promise<void> {
    const view = await McpTokenView.for(req, this.memberships);
    res.json({ tokens: await this.tokens.list(view), site: view.tenantId, platformAdmin: view.platformAdmin, multiTenant: TenantMode.isEnabled() });
  }

  async createToken(req: any, res: any): Promise<void> {
    const label = CoercionUtils.toString(req?.body?.label);
    if (!label) {
      res.status(400).json({ error: 'A label is required so a token can be recognised later.' });
      return;
    }

    const scopes = Array.isArray(req?.body?.scopes) ? req.body.scopes.map((s: any) => String(s || '')) : [];
    const expiresAt = req?.body?.expiresAt ? CoercionUtils.toString(req.body.expiresAt) : null;
    const userId = Number(req?.user?.id || 0);
    if (!userId) {
      res.status(400).json({ error: 'A token must belong to a user.' });
      return;
    }

    const view = await McpTokenView.for(req, this.memberships);
    let tenantId = view.tenantId;
    if (CoercionUtils.toString(req?.body?.site) === McpTokenController.ALL_SITES) {
      if (!view.platformAdmin) {
        res.status(403).json({ error: 'Only the platform admin can issue a token for all sites.' });
        return;
      }
      tenantId = null;
    } else if (TenantMode.isEnabled() && !tenantId) {
      res.status(400).json({ error: 'Select a site before issuing a token, or issue it for all sites.' });
      return;
    }

    const { rawKey, tokenId } = await this.tokens.issue(userId, label, scopes, expiresAt, tenantId);
    const token = (await this.tokens.list(view)).find((t) => t.tokenId === tokenId) || null;
    res.status(201).json({ token, rawKey });
  }

  async revokeToken(req: any, res: any): Promise<void> {
    const tokenId = CoercionUtils.toString(req?.params?.tokenId);
    const revoked = await this.tokens.revoke(tokenId, await McpTokenView.for(req, this.memberships));
    if (!revoked) {
      res.status(404).json({ error: `No MCP token "${tokenId}".` });
      return;
    }
    res.json({ revoked: true });
  }
}
