import { CoercionUtils } from '@fromcode119/core';
import { McpTokenService } from '@api/controllers/mcp/mcp-token-service';

/**
 * Admin-facing token management.
 *
 * `createToken`'s response is the ONLY place a raw key ever appears; every other endpoint returns
 * summaries that cannot contain one. These routes are guarded by an admin SESSION, not a token — a
 * token must not be able to mint another token, or a narrowly scoped one could escalate itself by
 * issuing a wider sibling.
 */
export class McpTokenController {
  constructor(private readonly tokens: McpTokenService) {}

  async listTokens(_req: any, res: any): Promise<void> {
    res.json({ tokens: await this.tokens.list() });
  }

  async createToken(req: any, res: any): Promise<void> {
    const label = CoercionUtils.toString(req?.body?.label).trim();
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

    const { rawKey, tokenId } = await this.tokens.issue(userId, label, scopes, expiresAt);
    const token = (await this.tokens.list()).find((t) => t.tokenId === tokenId) || null;
    res.status(201).json({ token, rawKey });
  }

  async revokeToken(req: any, res: any): Promise<void> {
    const tokenId = CoercionUtils.toString(req?.params?.tokenId);
    const revoked = await this.tokens.revoke(tokenId);
    if (!revoked) {
      res.status(404).json({ error: `No MCP token "${tokenId}".` });
      return;
    }
    res.json({ revoked: true });
  }
}
