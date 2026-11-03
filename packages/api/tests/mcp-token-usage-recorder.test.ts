import { describe, expect, it, vi } from 'vitest';
import { McpTokenRecord } from '@api/controllers/mcp/mcp-token-record';
import { McpTokenStore } from '@api/controllers/mcp/mcp-token-store';
import { McpTokenUsageRecorder } from '@api/controllers/mcp/mcp-token-usage-recorder';

/**
 * The LAST USED column of Integrations → MCP reads `lastUsedAt` from the token list. Nothing wrote it,
 * so every token read "never" however much it was used.
 */
describe('McpTokenUsageRecorder', () => {
  const buildDb = () => {
    const partitions = new Map<string, Map<string, any>>();
    let current = 'platform';
    const rows = () => {
      if (!partitions.has(current)) partitions.set(current, new Map());
      return partitions.get(current)!;
    };
    const scoped = async <T>(partition: string, fn: () => Promise<T>): Promise<T> => {
      const previous = current;
      current = partition;
      try { return await fn(); } finally { current = previous; }
    };
    return {
      partitions,
      findOne: vi.fn(async (_t: string, where: any) => rows().get(where.key) || null),
      update: vi.fn(async (_t: string, where: any, patch: any) => {
        const row = rows().get(where.key);
        if (!row || (where.value !== undefined && row.value !== where.value)) return null;
        rows().set(where.key, { ...row, ...patch });
        return row;
      }),
      withPlatformAdmin: <T>(fn: () => Promise<T>) => scoped('platform', fn),
      withTenant: <T>(tenantId: string, fn: () => Promise<T>) => scoped(tenantId, fn),
    };
  };
  const seed = (db: ReturnType<typeof buildDb>, partition: string, entries: any[]) => {
    if (!db.partitions.has(partition)) db.partitions.set(partition, new Map());
    db.partitions.get(partition)!.set(McpTokenStore.INDEX_KEY, { key: McpTokenStore.INDEX_KEY, value: JSON.stringify(entries) });
  };
  const listIn = (db: ReturnType<typeof buildDb>, partition: string) =>
    JSON.parse(db.partitions.get(partition)!.get(McpTokenStore.INDEX_KEY).value);
  const token = (tokenId: string, tenantId: string | null, legacy = false) =>
    new McpTokenRecord(tokenId, 1, 'laptop', undefined, null, tenantId, legacy);
  const logger = { warn: vi.fn() };
  const at = Date.parse('2026-11-03T12:00:00.000Z');

  it('records when a token was used on its own entry, leaving the others untouched', async () => {
    const db = buildDb();
    seed(db, 'platform', [{ tokenId: 'a', lastUsedAt: null }, { tokenId: 'b', lastUsedAt: null }]);

    await new McpTokenUsageRecorder(new McpTokenStore(db), logger).touch(token('a', 'acme'), at);

    expect(listIn(db, 'platform')).toEqual([{ tokenId: 'a', lastUsedAt: '2026-11-03T12:00:00.000Z' }, { tokenId: 'b', lastUsedAt: null }]);
  });

  it('writes a legacy token into the list of the site that issued it', async () => {
    const db = buildDb();
    seed(db, 'platform', [{ tokenId: 'other', lastUsedAt: null }]);
    seed(db, 'acme', [{ tokenId: 'old', lastUsedAt: null }]);

    await new McpTokenUsageRecorder(new McpTokenStore(db), logger).touch(token('old', 'acme', true), at);

    expect(listIn(db, 'acme')[0].lastUsedAt).toBe('2026-11-03T12:00:00.000Z');
    expect(listIn(db, 'platform')[0].lastUsedAt).toBeNull();
  });

  it('writes at most once a minute per token', async () => {
    const db = buildDb();
    seed(db, 'platform', [{ tokenId: 'a', lastUsedAt: null }]);
    const recorder = new McpTokenUsageRecorder(new McpTokenStore(db), logger);

    await recorder.touch(token('a', null), at);
    await recorder.touch(token('a', null), at + 30_000);
    expect(db.update).toHaveBeenCalledTimes(1);

    await recorder.touch(token('a', null), at + McpTokenUsageRecorder.INTERVAL_MS);
    expect(db.update).toHaveBeenCalledTimes(2);
    expect(listIn(db, 'platform')[0].lastUsedAt).toBe('2026-11-03T12:01:00.000Z');
  });

  it('never brings back an entry revoked while the write was on its way', async () => {
    const db = buildDb();
    seed(db, 'platform', [{ tokenId: 'a', lastUsedAt: null }]);
    const original = db.findOne.getMockImplementation()!;
    db.findOne.mockImplementationOnce(async (table: string, where: any) => {
      const read = await original(table, where);
      seed(db, 'platform', []);
      return read;
    });

    await new McpTokenUsageRecorder(new McpTokenStore(db), logger).touch(token('a', null), at);

    expect(listIn(db, 'platform')).toEqual([]);
  });

  it('only logs when the write fails', async () => {
    const db = buildDb();
    db.findOne.mockRejectedValueOnce(new Error('db down'));
    const warn = vi.fn();

    await expect(new McpTokenUsageRecorder(new McpTokenStore(db), { warn }).touch(token('a', null), at)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
