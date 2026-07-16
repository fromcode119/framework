jest.mock('@fromcode119/core', () => ({
  CoreServices: {
    getInstance: jest.fn(),
    reset: jest.fn(),
  },
  CoercionUtils: {
    toBoolean: jest.fn((value: unknown, fallback = false) => {
      if (typeof value === 'boolean') return value;
      const normalized = String(value ?? '').trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'off'].includes(normalized)) return false;
      return fallback;
    }),
  },
  PluginState: {
    ACTIVE: 'active',
  },
  EnvUtils: {
    number: jest.fn((name: string, fallback: number) => {
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
import { ResolutionService } from '../src/services/resolution-service';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Harness {
  service: ResolutionService;
  find: jest.Mock;
  metaFind: jest.Mock;
  gatesApply: jest.Mock;
  hookHandlers: Record<string, (payload: any) => void>;
}

function buildHarness(overrides: {
  findImpl?: (collection: any, options: any) => Promise<any>;
  withHooks?: boolean;
} = {}): Harness {
  const find = jest.fn().mockImplementation(
    overrides.findImpl ?? (() => Promise.resolve({ docs: [] })),
  );
  const metaFind = jest.fn().mockResolvedValue([]);
  const hookHandlers: Record<string, (payload: any) => void> = {};

  const manager: any = {
    db: { find: metaFind, findOne: jest.fn().mockResolvedValue(null) },
    getPlugins: jest.fn().mockReturnValue([{ state: 'active', manifest: { slug: 'cms' } }]),
    registeredCollections: new Map([
      [
        'pages',
        {
          pluginSlug: 'system',
          collection: {
            slug: 'pages',
            shortSlug: 'pages',
            fields: [{ name: 'slug' }, { name: 'customPermalink' }],
          },
        },
      ],
    ]),
  };
  if (overrides.withHooks !== false) {
    manager.hooks = {
      on: jest.fn((event: string, handler: (payload: any) => void) => {
        hookHandlers[event] = handler;
      }),
    };
  }
  const themeManager: any = {
    getActiveThemeDefaultPageContractOverrides: jest.fn().mockResolvedValue([]),
  };
  const gatesApply = jest.fn(async (resolved: any) => resolved);
  jest.spyOn(CoreServices, 'getInstance').mockReturnValue({
    contentResolutionGates: { apply: gatesApply },
    redirectResolvers: { resolve: jest.fn(async () => null) },
    defaultPageContractResolution: { resolveAll: jest.fn().mockReturnValue([]) },
  } as any);

  const service = new ResolutionService(manager, themeManager, { find } as any);
  return { service, find, metaFind, gatesApply, hookHandlers };
}

const matchContact = (_collection: any, options: any) => {
  if (options?.query?.slug === 'contact') {
    return Promise.resolve({ docs: [{ id: 7, slug: 'contact', title: 'Contact' }] });
  }
  return Promise.resolve({ docs: [] });
};

describe('ResolutionService anonymous result cache', () => {
  const ORIGINAL_TTL = process.env.RESOLVE_CACHE_TTL_MS;

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    if (ORIGINAL_TTL === undefined) delete process.env.RESOLVE_CACHE_TTL_MS;
    else process.env.RESOLVE_CACHE_TTL_MS = ORIGINAL_TTL;
  });

  it('serves repeat anonymous resolutions from cache (no second DB scan)', async () => {
    const { service, find } = buildHarness({ findImpl: matchContact });

    const first = await service.resolveSlug('/contact', {});
    const callsAfterFirst = find.mock.calls.length;
    const second = await service.resolveSlug('/contact', {});

    expect(first?.doc?.id).toBe(7);
    expect(second).toEqual(first);
    expect(find.mock.calls.length).toBe(callsAfterFirst); // no additional queries
  });

  it('runs content-resolution gates per request even on cache hits, with the visitor identity', async () => {
    const { service, gatesApply } = buildHarness({ findImpl: matchContact });

    await service.resolveSlug('/contact', {});
    // Second request: cached raw resolution, but the gate DENIES this visitor.
    gatesApply.mockResolvedValueOnce(null);
    const denied = await service.resolveSlug('/contact', { user: undefined });

    expect(gatesApply).toHaveBeenCalledTimes(2);
    expect(gatesApply.mock.calls[1][1]).toEqual({ user: undefined, preview: undefined });
    expect(denied).toBeNull();
  });

  it('bypasses the cache entirely for authenticated requests (no read, no write)', async () => {
    const { service, find } = buildHarness({ findImpl: matchContact });
    const user = { id: 1, roles: ['member'] };

    await service.resolveSlug('/contact', { user });
    const afterFirst = find.mock.calls.length;
    await service.resolveSlug('/contact', { user });
    const afterSecond = find.mock.calls.length;
    expect(afterSecond).toBeGreaterThan(afterFirst); // authenticated never reads a cached result

    // The authenticated resolution must not have been written either: a following
    // anonymous request performs its own scan.
    await service.resolveSlug('/contact', {});
    expect(find.mock.calls.length).toBeGreaterThan(afterSecond);
  });

  it('bypasses the cache entirely for preview requests', async () => {
    const { service, find } = buildHarness({ findImpl: matchContact });

    await service.resolveSlug('/contact', { preview: true });
    const afterFirst = find.mock.calls.length;
    await service.resolveSlug('/contact', { preview: true });
    expect(find.mock.calls.length).toBeGreaterThan(afterFirst);
  });

  it('keys the cache on locale so locales never cross-contaminate', async () => {
    const { service, find } = buildHarness({ findImpl: matchContact });

    await service.resolveSlug('/contact', { locale: 'bg' });
    const afterFirst = find.mock.calls.length;
    await service.resolveSlug('/contact', { locale: 'en' });
    expect(find.mock.calls.length).toBeGreaterThan(afterFirst); // different key → fresh scan
  });

  it('expires cached results after RESOLVE_CACHE_TTL_MS', async () => {
    process.env.RESOLVE_CACHE_TTL_MS = '40';
    const { service, find } = buildHarness({ findImpl: matchContact });

    await service.resolveSlug('/contact', {});
    const afterFirst = find.mock.calls.length;
    await sleep(70);
    await service.resolveSlug('/contact', {});
    expect(find.mock.calls.length).toBeGreaterThan(afterFirst);
  });

  it('RESOLVE_CACHE_TTL_MS=0 disables result caching', async () => {
    process.env.RESOLVE_CACHE_TTL_MS = '0';
    const { service, find } = buildHarness({ findImpl: matchContact });

    await service.resolveSlug('/contact', {});
    const afterFirst = find.mock.calls.length;
    await service.resolveSlug('/contact', {});
    expect(find.mock.calls.length).toBeGreaterThan(afterFirst);
  });

  it('caches anonymous misses (negative cache) to absorb 404 storms', async () => {
    const { service, find } = buildHarness();

    const first = await service.resolveSlug('/nope', {});
    const afterFirst = find.mock.calls.length;
    const second = await service.resolveSlug('/nope', {});

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(find.mock.calls.length).toBe(afterFirst);
  });

  it('invalidates cached results on any collection write hook', async () => {
    const { service, find, hookHandlers } = buildHarness({ findImpl: matchContact });

    await service.resolveSlug('/contact', {});
    const afterFirst = find.mock.calls.length;
    expect(typeof hookHandlers['collection:*:saved']).toBe('function');
    hookHandlers['collection:*:saved']({ id: 7 });
    await service.resolveSlug('/contact', {});
    expect(find.mock.calls.length).toBeGreaterThan(afterFirst); // cache cleared → fresh scan
  });

  it('invalidates the permalink-structure cache on the settings hook', async () => {
    const { service, metaFind, hookHandlers } = buildHarness({ findImpl: matchContact });

    await service.resolveSlug('/contact', {});
    expect(metaFind).toHaveBeenCalledTimes(1);
    // A different (uncached) slug reuses the cached permalink structure — no new meta scan.
    await service.resolveSlug('/other', {});
    expect(metaFind).toHaveBeenCalledTimes(1);

    hookHandlers['system:settings:updated']({ keys: ['permalink_structure'] });
    await service.resolveSlug('/third', {});
    expect(metaFind).toHaveBeenCalledTimes(2);
  });

  it('returns an isolated copy on cache hits — consumers cannot mutate the cached doc', async () => {
    const { service } = buildHarness({ findImpl: matchContact });

    const first: any = await service.resolveSlug('/contact', {});
    first.doc.title = 'MUTATED';
    const second: any = await service.resolveSlug('/contact', {});

    expect(second.doc.title).toBe('Contact');
  });

  it('preserves candidate priority order even though per-collection finds run in parallel', async () => {
    // '/contact' produces custom-permalink candidates ['/contact', 'contact'] then slug 'contact'.
    // ALL of them match different docs; the FIRST candidate must still win deterministically.
    const { service } = buildHarness({
      findImpl: (_collection: any, options: any) => {
        if (options?.query?.customPermalink === '/contact') return Promise.resolve({ docs: [{ id: 1 }] });
        if (options?.query?.customPermalink === 'contact') return Promise.resolve({ docs: [{ id: 2 }] });
        if (options?.query?.slug === 'contact') return Promise.resolve({ docs: [{ id: 3 }] });
        return Promise.resolve({ docs: [] });
      },
    });

    const result = await service.resolveSlug('/contact', { user: { id: 9 } }); // bypass cache — pure ordering test
    expect(result?.doc?.id).toBe(1);
  });

  it('falls through to later candidates when the first parallel find rejects', async () => {
    const { service } = buildHarness({
      findImpl: (_collection: any, options: any) => {
        if (options?.query?.customPermalink === '/contact') return Promise.reject(new Error('schema mismatch'));
        if (options?.query?.slug === 'contact') return Promise.resolve({ docs: [{ id: 3 }] });
        return Promise.resolve({ docs: [] });
      },
    });

    const result = await service.resolveSlug('/contact', { user: { id: 9 } });
    expect(result?.doc?.id).toBe(3);
  });
});
