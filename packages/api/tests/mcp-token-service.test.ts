import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import { TenantMode } from '@fromcode119/core';
import { McpTokenService } from '../src/controllers/mcp/mcp-token-service';
import { McpTokenStore } from '../src/controllers/mcp/mcp-token-store';
import { McpTokenView } from '../src/controllers/mcp/mcp-token-view';
import { McpTokenLookupService } from '../src/controllers/mcp/mcp-token-lookup-service';

/**
 * A `_system_meta` stand-in with PARTITIONS: the platform partition (rows written under the
 * platform-admin marker) and one per tenant. `withTenant` / `withPlatformAdmin` switch which one the
 * plain CRUD calls see — the same shape the real manager gives the store.
 */
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
    /** The request's own binding — tests pick which site the "session" is in. */
    bind(partition: string) { current = partition; },
    insert: vi.fn(async (_t: string, row: any) => { rows().set(row.key, row); return row; }),
    findOne: vi.fn(async (_t: string, where: any) => rows().get(where.key) || null),
    update: vi.fn(async (_t: string, where: any, patch: any) => {
      const row = rows().get(where.key);
      if (!row) return null;
      const next = { ...row, ...patch };
      rows().set(where.key, next);
      return next;
    }),
    delete: vi.fn(async (_t: string, where: any) => rows().delete(where.key)),
    withPlatformAdmin: <T>(fn: () => Promise<T>) => scoped('platform', fn),
    withTenant: <T>(tenantId: string, fn: () => Promise<T>) => scoped(tenantId, fn),
  };
};

const service = (db: any) => new McpTokenService(new McpTokenStore(db));
const platformView = new McpTokenView(null, true);
const hashOf = (rawKey: string) => createHash('sha256').update(rawKey).digest('hex');
const multiTenant = () => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

afterEach(() => TenantMode.reset());

describe('McpTokenService.issue', () => {
  it('returns a raw key and stores only its hash, in the platform partition', async () => {
    const db = buildDb();
    db.bind('acme');
    const { rawKey, tokenId } = await service(db).issue(1, 'laptop', ['content.*'], null, 'acme');

    expect(rawKey).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenId).toBeTruthy();
    const platform = db.partitions.get('platform')!;
    expect(platform.has(`auth:api_token:${hashOf(rawKey)}`)).toBe(true);
    expect(db.partitions.get('acme')).toBeUndefined();
    expect(JSON.stringify([...platform.values()])).not.toContain(rawKey);
  });

  it('records the site the token is bound to, and drops blank scopes', async () => {
    const db = buildDb();
    const { rawKey } = await service(db).issue(7, 'ci', ['media.*', '  ', 'content.list'], null, 'acme');
    const payload = JSON.parse(db.partitions.get('platform')!.get(`auth:api_token:${hashOf(rawKey)}`).value);
    expect(payload).toMatchObject({ userId: 7, scopes: ['media.*', 'content.list'], tenantId: 'acme' });
    expect(payload.tokenId).toBeTruthy();
  });

  it('records null for an all-sites token', async () => {
    const db = buildDb();
    const { rawKey } = await service(db).issue(7, 'ops', [], null, null);
    expect(JSON.parse(db.partitions.get('platform')!.get(`auth:api_token:${hashOf(rawKey)}`).value).tenantId).toBeNull();
  });
});

describe('McpTokenService.list', () => {
  it('never returns the key or its hash', async () => {
    const db = buildDb();
    const tokens = service(db);
    const { rawKey } = await tokens.issue(1, 'laptop', ['content.*'], null, null);

    const summaries = await tokens.list(platformView);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ label: 'laptop', scopes: ['content.*'], site: null, legacy: false });
    const serialised = JSON.stringify(summaries);
    expect(serialised).not.toContain(rawKey);
    expect(serialised).not.toContain(hashOf(rawKey));
  });

  it('shows a site admin only their own site\'s tokens; the platform admin sees all', async () => {
    multiTenant();
    const db = buildDb();
    const tokens = service(db);
    await tokens.issue(1, 'acme-token', [], null, 'acme');
    await tokens.issue(1, 'globex-token', [], null, 'globex');
    await tokens.issue(1, 'everywhere', [], null, null);

    db.bind('acme'); // the site admin's session is bound to acme — its legacy reads hit acme's partition
    expect((await tokens.list(new McpTokenView('acme', false))).map((t) => t.label)).toEqual(['acme-token']);
    expect((await tokens.list(new McpTokenView(null, true))).map((t) => t.label).sort()).toEqual(['acme-token', 'everywhere', 'globex-token']);
  });

  it('includes the site\'s legacy tokens (rows in its own partition) marked legacy', async () => {
    multiTenant();
    const db = buildDb();
    db.bind('acme');
    db.partitions.set('acme', new Map([[McpTokenStore.INDEX_KEY, { key: McpTokenStore.INDEX_KEY, value: JSON.stringify([{ tokenId: 'old', label: 'pre-site token', scopes: [], createdAt: 'x', keyHash: 'h' }]) }]]));
    const listed = await service(db).list(new McpTokenView('acme', false));
    expect(listed).toEqual([expect.objectContaining({ tokenId: 'old', site: 'acme', legacy: true })]);
  });

  it('returns an empty list before any token exists', async () => {
    expect(await service(buildDb()).list(platformView)).toEqual([]);
  });
});

describe('McpTokenService.revoke', () => {
  it('deletes the credential row and drops it from the list', async () => {
    const db = buildDb();
    const tokens = service(db);
    const { rawKey, tokenId } = await tokens.issue(1, 'laptop', ['content.*'], null, null);

    expect(await tokens.revoke(tokenId, platformView)).toBe(true);
    expect(db.partitions.get('platform')!.has(`auth:api_token:${hashOf(rawKey)}`)).toBe(false);
    expect(await tokens.list(platformView)).toEqual([]);
  });

  it('refuses to revoke another site\'s token', async () => {
    multiTenant();
    const db = buildDb();
    const tokens = service(db);
    const { tokenId } = await tokens.issue(1, 'globex-token', [], null, 'globex');
    expect(await tokens.revoke(tokenId, new McpTokenView('acme', false))).toBe(false);
    expect(await tokens.list(platformView)).toHaveLength(1);
  });

  it('reports failure for an unknown token rather than pretending', async () => {
    expect(await service(buildDb()).revoke('nope', platformView)).toBe(false);
  });

  it('leaves other tokens alone', async () => {
    const db = buildDb();
    const tokens = service(db);
    const first = await tokens.issue(1, 'one', ['content.*'], null, null);
    await tokens.issue(1, 'two', ['media.*'], null, null);

    await tokens.revoke(first.tokenId, platformView);
    expect((await tokens.list(platformView)).map((t) => t.label)).toEqual(['two']);
  });
});

describe('McpTokenLookupService.find', () => {
  it('finds a token in the platform partition with its site, before any tenant is bound', async () => {
    multiTenant();
    const db = buildDb();
    const { rawKey } = await service(db).issue(3, 'acme-token', ['content.*'], null, 'acme');
    const record = await new McpTokenLookupService(new McpTokenStore(db), async () => []).find(rawKey);
    expect(record).toMatchObject({ userId: 3, tenantId: 'acme', legacy: false, allSites: false });
  });

  it('finds a legacy token in the site partition that issued it, bound to THAT site', async () => {
    multiTenant();
    const db = buildDb();
    const raw = 'legacy-raw-key';
    db.partitions.set('globex', new Map([[`auth:api_token:${hashOf(raw)}`, { key: `auth:api_token:${hashOf(raw)}`, value: JSON.stringify({ userId: 9, tokenId: 'old', scopes: [] }) }]]));
    const tenants = vi.fn(async () => [{ id: 'acme' }, { id: 'globex' }] as any);
    const lookup = new McpTokenLookupService(new McpTokenStore(db), tenants);

    expect(await lookup.find(raw)).toMatchObject({ userId: 9, tenantId: 'globex', legacy: true });
    // The sweep across sites happens once; the remembered home is re-read directly afterwards.
    expect(await lookup.find(raw)).toMatchObject({ tenantId: 'globex' });
    expect(tenants).toHaveBeenCalledTimes(1);
  });

  it('returns null for an unknown key, and for a blank one', async () => {
    const lookup = new McpTokenLookupService(new McpTokenStore(buildDb()), async () => []);
    expect(await lookup.find('nope')).toBeNull();
    expect(await lookup.find('')).toBeNull();
  });
});
