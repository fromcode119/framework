vi.mock('@fromcode119/core', () => ({
  CoreServices: {
    getInstance: vi.fn(),
    reset: vi.fn(),
  },
  CoercionUtils: {
    toBoolean: vi.fn((value: unknown, fallback = false) => {
      if (typeof value === 'boolean') return value;
      return fallback;
    }),
  },
  PluginState: {
    ACTIVE: 'active',
  },
  EnvUtils: {
    number: vi.fn((name: string, fallback: number) => {
      const raw = process.env[name];
      if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
      const parsed = Number(String(raw).trim());
      return Number.isFinite(parsed) ? parsed : fallback;
    }),
  },
  SystemConstants: {
    TABLE: {
      META: 'meta',
    },
  },
}));

import { CoreServices } from '@fromcode119/core';
import { ResolutionService } from '@api/services/resolution-service';

const QUERY_DELAY_MS = 3;
const COLLECTIONS = 30;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function buildService() {
  const concurrency = { inFlight: 0, max: 0 };
  const find = vi.fn().mockImplementation(async () => {
    concurrency.inFlight += 1;
    concurrency.max = Math.max(concurrency.max, concurrency.inFlight);
    await sleep(QUERY_DELAY_MS);
    concurrency.inFlight -= 1;
    return { docs: [] };
  });
  const registeredCollections = new Map(
    Array.from({ length: COLLECTIONS }, (_, i) => [
      `col${i}`,
      {
        pluginSlug: 'system',
        collection: {
          slug: `col${i}`,
          shortSlug: `col${i}`,
          fields: [{ name: 'slug' }, { name: 'customPermalink' }],
        },
      },
    ]),
  );
  const manager: any = {
    db: { find: vi.fn().mockResolvedValue([]), findOne: vi.fn().mockResolvedValue(null) },
    getPlugins: vi.fn().mockReturnValue([]),
    registeredCollections,
  };
  const themeManager: any = {
    getActiveThemeDefaultPageContractOverrides: vi.fn().mockResolvedValue([]),
  };
  vi.spyOn(CoreServices, 'getInstance').mockReturnValue({
    contentResolutionGates: { apply: vi.fn(async (resolved: any) => resolved) },
    redirectResolvers: { resolve: vi.fn(async () => null) },
    defaultPageContractResolution: { resolveAll: vi.fn().mockReturnValue([]) },
  } as any);
  return { service: new ResolutionService(manager, themeManager, { find } as any), find, concurrency };
}

describe('ResolutionService micro-bench (worst-case miss over 30 slug-bearing collections)', () => {
  const ORIGINAL_TTL = process.env.RESOLVE_CACHE_TTL_MS;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    if (ORIGINAL_TTL === undefined) delete process.env.RESOLVE_CACHE_TTL_MS;
    else process.env.RESOLVE_CACHE_TTL_MS = ORIGINAL_TTL;
  });

  it('parallelized scan issues the same queries but far fewer sequential await rounds; cache hit issues zero', async () => {
    const { service, find, concurrency } = buildService();

    const t0 = Date.now();
    const miss = await service.resolveSlug('/definitely-not-a-page', {});
    const uncachedMs = Date.now() - t0;
    const uncachedQueries = find.mock.calls.length;

    const t1 = Date.now();
    const missCached = await service.resolveSlug('/definitely-not-a-page', {});
    const cachedMs = Date.now() - t1;
    const cachedQueries = find.mock.calls.length - uncachedQueries;

    const theoreticalSequentialMs = uncachedQueries * QUERY_DELAY_MS;

    // Deterministic assertions (query counts — semantics unchanged, cache absorbs the repeat):
    expect(miss).toBeNull();
    expect(missCached).toBeNull();
    // Pass 1: 30 collections × (2 customPermalink candidates + 1 slug candidate) = 90.
    // Pass 2: 30 collections × 1 structure query = 30. Total 120 — identical to the old loop.
    expect(uncachedQueries).toBe(120);
    expect(cachedQueries).toBe(0);
    // Parallelism proof (deterministic, CI-safe — wall-clock jitters under parallel jest workers):
    // the old loop awaited every query back-to-back (in-flight never exceeded 1); the restructured
    // scan runs one collection's 3 candidates (pass 1) / a 4-collection chunk (pass 2) concurrently.
    expect(concurrency.max).toBeGreaterThanOrEqual(3);
    expect(concurrency.max).toBeLessThanOrEqual(4); // bounded — never a 120-query stampede

    // eslint-disable-next-line no-console
    console.log(
      `[resolve bench] queries=${uncachedQueries} @ ${QUERY_DELAY_MS}ms | ` +
      `old sequential (theoretical)=${theoreticalSequentialMs}ms | ` +
      `restructured uncached=${uncachedMs}ms (max in-flight ${concurrency.max}) | cached repeat=${cachedMs}ms (${cachedQueries} queries)`,
    );
  });
});
