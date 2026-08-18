import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import { McpTokenService } from '../src/controllers/mcp/mcp-token-service';

const buildDb = () => {
  const rows = new Map<string, any>();
  return {
    rows,
    insert: vi.fn(async (_t: string, row: any) => { rows.set(row.key, row); return row; }),
    findOne: vi.fn(async (_t: string, where: any) => rows.get(where.key) || null),
    update: vi.fn(async (_t: string, where: any, patch: any) => {
      const row = rows.get(where.key);
      if (!row) return null;
      const next = { ...row, ...patch };
      rows.set(where.key, next);
      return next;
    }),
    delete: vi.fn(async (_t: string, where: any) => rows.delete(where.key)),
  };
};

describe('McpTokenService.issue', () => {
  it('returns a raw key and stores only its hash', async () => {
    const db = buildDb();
    const { rawKey, tokenId } = await new McpTokenService(db as any).issue(1, 'laptop', ['content.*'], null);

    expect(rawKey).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenId).toBeTruthy();
    const expectedKey = `auth:api_token:${createHash('sha256').update(rawKey).digest('hex')}`;
    expect(db.rows.has(expectedKey)).toBe(true);
    expect(JSON.stringify([...db.rows.values()])).not.toContain(rawKey);
  });

  it('stores the scopes it was given, dropping blanks', async () => {
    const db = buildDb();
    await new McpTokenService(db as any).issue(1, 'ci', ['media.*', '  ', 'content.list'], null);
    const tokenRow = [...db.rows.values()].find((r) => r.key.startsWith('auth:api_token:'));
    expect(JSON.parse(tokenRow.value).scopes).toEqual(['media.*', 'content.list']);
  });

  it('writes a payload the auth validator can read back', async () => {
    const db = buildDb();
    const { rawKey } = await new McpTokenService(db as any).issue(7, 'laptop', ['content.*'], null);
    const hash = createHash('sha256').update(rawKey).digest('hex');
    const payload = JSON.parse(db.rows.get(`auth:api_token:${hash}`).value);
    expect(payload.userId).toBe(7);
    expect(payload.tokenId).toBeTruthy();
    expect(payload.scopes).toEqual(['content.*']);
  });
});

describe('McpTokenService.list', () => {
  it('never returns the key or its hash', async () => {
    const db = buildDb();
    const service = new McpTokenService(db as any);
    const { rawKey } = await service.issue(1, 'laptop', ['content.*'], null);

    const summaries = await service.list();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].label).toBe('laptop');
    expect(summaries[0].scopes).toEqual(['content.*']);

    const serialised = JSON.stringify(summaries);
    expect(serialised).not.toContain(rawKey);
    expect(serialised).not.toContain(createHash('sha256').update(rawKey).digest('hex'));
  });

  it('returns an empty list before any token exists', async () => {
    expect(await new McpTokenService(buildDb() as any).list()).toEqual([]);
  });
});

describe('McpTokenService.revoke', () => {
  it('deletes the credential row and drops it from the list', async () => {
    const db = buildDb();
    const service = new McpTokenService(db as any);
    const { rawKey, tokenId } = await service.issue(1, 'laptop', ['content.*'], null);
    const hash = createHash('sha256').update(rawKey).digest('hex');

    expect(await service.revoke(tokenId)).toBe(true);
    expect(db.rows.has(`auth:api_token:${hash}`)).toBe(false);
    expect(await service.list()).toEqual([]);
  });

  it('reports failure for an unknown token rather than pretending', async () => {
    expect(await new McpTokenService(buildDb() as any).revoke('nope')).toBe(false);
  });

  it('leaves other tokens alone', async () => {
    const db = buildDb();
    const service = new McpTokenService(db as any);
    const first = await service.issue(1, 'one', ['content.*'], null);
    await service.issue(1, 'two', ['media.*'], null);

    await service.revoke(first.tokenId);
    const remaining = await service.list();
    expect(remaining.map((t) => t.label)).toEqual(['two']);
  });
});
