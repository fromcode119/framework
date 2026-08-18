import { createHash, randomBytes, randomUUID } from 'crypto';
import { SystemConstants } from '@fromcode119/core';
import { IMcpTokenSummary } from '@api/controllers/mcp/interfaces/mcp-token-summary.interface';

/**
 * Issues, lists and revokes MCP API tokens.
 *
 * The RAW key is returned exactly once, at issue time, and never stored — only its SHA-256 hash,
 * used as the `_system_meta` row key, which is the same lookup `setApiKeyValidator` already performs.
 * `list()` therefore cannot leak a key even by accident, because the service never holds one.
 *
 * A single INDEX row tracks which tokens exist. The alternative — scanning `_system_meta` and
 * filtering by key prefix in code — would read every settings row in the system on each call, and an
 * unfiltered read that happens to be filtered afterwards is the pattern this codebase treats as a bug.
 * Every operation here touches rows by exact key.
 */
export class McpTokenService {
  private static readonly TOKEN_PREFIX = 'auth:api_token:';
  private static readonly INDEX_KEY = 'mcp:token_index';

  constructor(private readonly db: any) {}

  async issue(userId: number, label: string, scopes: string[], expiresAt: string | null): Promise<{ rawKey: string; tokenId: string }> {
    const rawKey = randomBytes(32).toString('hex');
    const tokenId = randomUUID();
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const createdAt = new Date().toISOString();
    const cleanScopes = scopes.map((s) => String(s || '').trim()).filter(Boolean);

    await this.db.insert(SystemConstants.TABLE.META, {
      key: `${McpTokenService.TOKEN_PREFIX}${keyHash}`,
      value: JSON.stringify({ userId, tokenId, label: String(label || '').trim(), scopes: cleanScopes, createdAt, expiresAt }),
    });

    const index = await this.readIndex();
    index.push({ tokenId, label: String(label || '').trim(), scopes: cleanScopes, createdAt, expiresAt, lastUsedAt: null, keyHash });
    await this.writeIndex(index);

    return { rawKey, tokenId };
  }

  async list(): Promise<IMcpTokenSummary[]> {
    return (await this.readIndex()).map((entry) => ({
      tokenId: String(entry.tokenId || ''),
      label: String(entry.label || ''),
      scopes: Array.isArray(entry.scopes) ? entry.scopes.map((s: any) => String(s)) : [],
      createdAt: String(entry.createdAt || ''),
      expiresAt: entry.expiresAt ? String(entry.expiresAt) : null,
      lastUsedAt: entry.lastUsedAt ? String(entry.lastUsedAt) : null,
    }));
  }

  async revoke(tokenId: string): Promise<boolean> {
    const target = String(tokenId || '').trim();
    if (!target) return false;

    const index = await this.readIndex();
    const entry = index.find((e) => String(e.tokenId) === target);
    if (!entry) return false;

    // The credential row goes first. If the index write then failed, the worst outcome is an orphaned
    // index entry for a key that no longer authenticates — the reverse order could leave a live key
    // that nothing lists.
    await this.db.delete(SystemConstants.TABLE.META, { key: `${McpTokenService.TOKEN_PREFIX}${entry.keyHash}` });
    await this.writeIndex(index.filter((e) => String(e.tokenId) !== target));
    return true;
  }

  private async readIndex(): Promise<any[]> {
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key: McpTokenService.INDEX_KEY });
    if (!row?.value) return [];
    try {
      const parsed = JSON.parse(String(row.value));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async writeIndex(entries: any[]): Promise<void> {
    // findOne -> insert/update, the pattern `ServerSettingsService` already uses on this table.
    // `upsert` is NOT usable here: it resolves its conflict target with `table[options.target]`, which
    // needs a Drizzle table OBJECT. `SystemConstants.TABLE.META` is a NAME string, so the target came
    // out `undefined` and drizzle threw inside `.values()`. The unit-test mock hid it by accepting any
    // arguments at all.
    const value = JSON.stringify(entries);
    const existing = await this.db.findOne(SystemConstants.TABLE.META, { key: McpTokenService.INDEX_KEY });
    if (existing) {
      await this.db.update(SystemConstants.TABLE.META, { key: McpTokenService.INDEX_KEY }, { value });
      return;
    }
    await this.db.insert(SystemConstants.TABLE.META, { key: McpTokenService.INDEX_KEY, value });
  }
}
