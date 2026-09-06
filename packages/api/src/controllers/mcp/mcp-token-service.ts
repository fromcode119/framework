import { randomBytes, randomUUID } from 'crypto';
import { CoercionUtils, TenantMode } from '@fromcode119/core';
import { McpTokenStore } from '@api/controllers/mcp/mcp-token-store';
import { McpTokenView } from '@api/controllers/mcp/mcp-token-view';
import { IMcpTokenSummary } from '@api/controllers/mcp/interfaces/mcp-token-summary.interface';

/**
 * Issues, lists and revokes MCP API tokens.
 *
 * The RAW key is returned exactly once, at issue time, and never stored — only its SHA-256 hash, used
 * as the row key, which is the same lookup `McpTokenLookupService` performs. `list()` therefore cannot
 * leak a key even by accident, because the service never holds one.
 *
 * Every token records the SITE it is bound to (`tenantId`, or `null` for all sites), and lives in the
 * platform partition so an api-key request can find it before any site is bound. Tokens issued before
 * that lived in their issuing site's partition; they are listed and revoked from that site's session
 * exactly as before, marked `legacy`.
 */
export class McpTokenService {
  constructor(private readonly store: McpTokenStore) {}

  async issue(userId: number, label: string, scopes: string[], expiresAt: string | null, tenantId: string | null): Promise<{ rawKey: string; tokenId: string }> {
    const rawKey = randomBytes(32).toString('hex');
    const tokenId = randomUUID();
    const hash = McpTokenStore.hash(rawKey);
    const createdAt = new Date().toISOString();
    const cleanScopes = scopes.map((s) => CoercionUtils.toString(s).trim()).filter(Boolean);
    const cleanLabel = CoercionUtils.toString(label).trim();

    await this.store.writePlatformRow(hash, { userId, tokenId, label: cleanLabel, scopes: cleanScopes, createdAt, expiresAt, tenantId });

    const index = await this.store.readPlatformIndex();
    index.push({ tokenId, label: cleanLabel, scopes: cleanScopes, createdAt, expiresAt, lastUsedAt: null, keyHash: hash, tenantId });
    await this.store.writePlatformIndex(index);

    return { rawKey, tokenId };
  }

  /** The tokens `view` may see: platform-partition tokens it is allowed to, plus its site's legacy tokens. */
  async list(view: McpTokenView): Promise<IMcpTokenSummary[]> {
    const platform = (await this.store.readPlatformIndex())
      .filter((entry) => view.sees(McpTokenService.tenantOf(entry)))
      .map((entry) => McpTokenService.summary(entry, McpTokenService.tenantOf(entry), false));
    if (!TenantMode.isEnabled() || !view.tenantId) return platform;
    const legacy = (await this.store.readScopedIndex()).map((entry) => McpTokenService.summary(entry, view.tenantId, true));
    return [...platform, ...legacy];
  }

  async revoke(tokenId: string, view: McpTokenView): Promise<boolean> {
    const target = CoercionUtils.toString(tokenId).trim();
    if (!target) return false;

    const index = await this.store.readPlatformIndex();
    const entry = index.find((e) => String(e.tokenId) === target);
    if (entry) {
      if (!view.sees(McpTokenService.tenantOf(entry))) return false;
      // The credential row goes first. If the index write then failed, the worst outcome is an
      // orphaned index entry for a key that no longer authenticates — the reverse order could leave
      // a live key that nothing lists.
      await this.store.deletePlatformRow(String(entry.keyHash));
      await this.store.writePlatformIndex(index.filter((e) => String(e.tokenId) !== target));
      return true;
    }

    if (!TenantMode.isEnabled() || !view.tenantId) return false;
    const scoped = await this.store.readScopedIndex();
    const legacy = scoped.find((e) => String(e.tokenId) === target);
    if (!legacy) return false;
    await this.store.deleteScopedRow(String(legacy.keyHash));
    await this.store.writeScopedIndex(scoped.filter((e) => String(e.tokenId) !== target));
    return true;
  }

  private static tenantOf(entry: any): string | null {
    const tenant = CoercionUtils.toString(entry?.tenantId).trim();
    return tenant || null;
  }

  private static summary(entry: any, site: string | null, legacy: boolean): IMcpTokenSummary {
    return {
      tokenId: String(entry.tokenId || ''),
      label: String(entry.label || ''),
      scopes: Array.isArray(entry.scopes) ? entry.scopes.map((s: any) => String(s)) : [],
      createdAt: String(entry.createdAt || ''),
      expiresAt: entry.expiresAt ? String(entry.expiresAt) : null,
      lastUsedAt: entry.lastUsedAt ? String(entry.lastUsedAt) : null,
      site,
      legacy,
    };
  }
}
