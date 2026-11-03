import type { Logger } from '@fromcode119/core';
import { McpTokenRecord } from '@api/controllers/mcp/mcp-token-record';
import { McpTokenStore } from '@api/controllers/mcp/mcp-token-store';

/**
 * Writes "last used" on a token's entry in the token list each time its key authenticates, which is
 * what the Integrations → MCP table's LAST USED column reads.
 *
 * At most once a minute per token: the list is one row shared by every token, so writing it on every
 * request would turn each api call into a write. The write runs after the request is let through and a
 * failure only logs — recording use must never refuse a valid key.
 */
export class McpTokenUsageRecorder {
  static readonly INTERVAL_MS = 60_000;

  private readonly recordedAt = new Map<string, number>();

  constructor(private readonly store: McpTokenStore, private readonly logger: Pick<Logger, 'warn'>) {}

  touch(record: McpTokenRecord, now: number = Date.now()): Promise<void> {
    if (now - (this.recordedAt.get(record.tokenId) ?? 0) < McpTokenUsageRecorder.INTERVAL_MS) return Promise.resolve();
    this.recordedAt.set(record.tokenId, now);
    return this.write(record, new Date(now).toISOString())
      .catch((error: unknown) => this.logger.warn(`Could not record use of MCP token ${record.tokenId}: ${error}`));
  }

  private async write(record: McpTokenRecord, at: string): Promise<void> {
    // A legacy token's list lives in the partition of the site that issued it; every other token's in
    // the platform partition — the same place `McpTokenService` lists them from.
    const partition = record.legacy ? record.tenantId : null;
    const previous = await this.store.readRawIn(partition, McpTokenStore.INDEX_KEY);
    if (!previous) return;
    const entries = JSON.parse(previous);
    if (!Array.isArray(entries)) return;
    const entry = entries.find((candidate: any) => String(candidate?.tokenId) === record.tokenId);
    if (!entry) return;
    entry.lastUsedAt = at;
    await this.store.replaceRawIfUnchanged(partition, McpTokenStore.INDEX_KEY, previous, JSON.stringify(entries));
  }
}
