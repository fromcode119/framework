import { createHash } from 'crypto';
import { SystemConstants } from '@fromcode119/core';

/**
 * Where MCP tokens live: `_system_meta` rows keyed by the SHA-256 of the raw key, plus one INDEX row
 * listing the tokens that exist (so `list` never scans the table).
 *
 * Tokens now live in the PLATFORM partition (`tenant_id IS NULL`, written and read under the
 * platform-admin marker) and carry their site inside the row. That is what lets an api-key request
 * find its token BEFORE any tenant is bound — the token is how the site is chosen, so the site
 * cannot be needed to find the token. Rows written before this change sit in the partition of the
 * site that issued them; the "scoped" and "tenant" readers below reach those, and only those.
 */
export class McpTokenStore {
  static readonly TOKEN_PREFIX = 'auth:api_token:';
  static readonly INDEX_KEY = 'mcp:token_index';

  constructor(private readonly db: any) {}

  static hash(rawKey: string): string {
    return createHash('sha256').update(String(rawKey || '').trim()).digest('hex');
  }

  static keyFor(hash: string): string {
    return `${McpTokenStore.TOKEN_PREFIX}${hash}`;
  }

  // ---- platform partition (tokens issued with a site recorded, and pre-tenancy rows) ----

  readPlatformRow(hash: string): Promise<any> {
    return this.db.withPlatformAdmin(() => this.db.findOne(SystemConstants.TABLE.META, { key: McpTokenStore.keyFor(hash) }));
  }

  writePlatformRow(hash: string, value: Record<string, unknown>): Promise<void> {
    return this.db.withPlatformAdmin(() => this.db.insert(SystemConstants.TABLE.META, { key: McpTokenStore.keyFor(hash), value: JSON.stringify(value) }));
  }

  deletePlatformRow(hash: string): Promise<void> {
    return this.db.withPlatformAdmin(() => this.db.delete(SystemConstants.TABLE.META, { key: McpTokenStore.keyFor(hash) }));
  }

  readPlatformIndex(): Promise<any[]> {
    return this.db.withPlatformAdmin(() => this.readIndex());
  }

  writePlatformIndex(entries: any[]): Promise<void> {
    return this.db.withPlatformAdmin(() => this.writeIndex(entries));
  }

  // ---- the partition the CURRENT request is bound to (legacy rows of that site) ----

  readScopedRow(hash: string): Promise<any> {
    return this.db.findOne(SystemConstants.TABLE.META, { key: McpTokenStore.keyFor(hash) });
  }

  deleteScopedRow(hash: string): Promise<void> {
    return this.db.delete(SystemConstants.TABLE.META, { key: McpTokenStore.keyFor(hash) });
  }

  readScopedIndex(): Promise<any[]> {
    return this.readIndex();
  }

  writeScopedIndex(entries: any[]): Promise<void> {
    return this.writeIndex(entries);
  }

  // ---- a NAMED site's partition (finding a legacy token before any tenant is bound) ----

  readTenantRow(tenantId: string, hash: string): Promise<any> {
    return this.db.withTenant(tenantId, () => this.db.findOne(SystemConstants.TABLE.META, { key: McpTokenStore.keyFor(hash) }));
  }

  // ---- a list row in the partition that holds a token (recording when the token was last used) ----

  /** The raw stored value of `key` in `tenantId`'s partition, or the platform partition for `null`. */
  async readRawIn(tenantId: string | null, key: string): Promise<string | null> {
    const row: any = await this.inPartition(tenantId, () => this.db.findOne(SystemConstants.TABLE.META, { key }));
    return row?.value ? String(row.value) : null;
  }

  /**
   * Rewrites `key` only while it still holds `previous`. A list that changed in between — a token
   * issued or revoked — is left alone, so a late write can never bring a revoked entry back.
   */
  replaceRawIfUnchanged(tenantId: string | null, key: string, previous: string, next: string): Promise<unknown> {
    return this.inPartition(tenantId, () => this.db.update(SystemConstants.TABLE.META, { key, value: previous }, { value: next }));
  }

  private inPartition<T>(tenantId: string | null, work: () => Promise<T>): Promise<T> {
    return tenantId ? this.db.withTenant(tenantId, work) : this.db.withPlatformAdmin(work);
  }

  private async readIndex(): Promise<any[]> {
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key: McpTokenStore.INDEX_KEY });
    if (!row?.value) return [];
    try {
      const parsed = JSON.parse(String(row.value));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async writeIndex(entries: any[]): Promise<void> {
    // findOne -> insert/update, the pattern `ServerSettingsService` uses on this table. `upsert` is
    // NOT usable here: it resolves its conflict target with `table[options.target]`, which needs a
    // declared table OBJECT; `SystemConstants.TABLE.META` is a NAME string.
    const value = JSON.stringify(entries);
    const existing = await this.db.findOne(SystemConstants.TABLE.META, { key: McpTokenStore.INDEX_KEY });
    if (existing) {
      await this.db.update(SystemConstants.TABLE.META, { key: McpTokenStore.INDEX_KEY }, { value });
      return;
    }
    await this.db.insert(SystemConstants.TABLE.META, { key: McpTokenStore.INDEX_KEY, value });
  }
}
