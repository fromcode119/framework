/**
 * Mock ONLY the `CoreServices` singleton — everything else is the REAL module.
 *
 * This used to be a hand-rolled fake that re-declared `PluginState`, `CoercionUtils`, `EnvUtils` and
 * `SystemConstants` as plain objects. Two things went wrong with that:
 *
 *  1. When the plain-enum -> reactor `Enum` migration added `PluginDefaultPageContractResolutionStatus`
 *     and `PluginDefaultPageContractMaterializationMode` to core, the fake was never updated, so vitest
 *     threw `No "PluginDefaultPageContractResolutionStatus" export is defined on the mock` and ALL SEVEN
 *     routing tests were dark — the permalink / default-page-contract routing surface was verified by
 *     nothing.
 *  2. The fake declared `PluginState.ACTIVE` as the raw string `'active'`, so the suite asserted against
 *     a contract production does not have: the real members are reactor `Enum` SINGLETONS, and
 *     `member === 'active'` is ALWAYS false. A fixture built from raw strings can pass here and still
 *     be wrong in production.
 *
 * Spreading the actual module means the mock can never drift from core's exports again, and the enum
 * identity comparisons in `ResolutionService` (`contract.status !== …READY`) are exercised for real.
 */
vi.mock('@fromcode119/core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@fromcode119/core');
  return {
    ...actual,
    CoreServices: {
      getInstance: vi.fn(),
      reset: vi.fn(),
    },
  };
});

import {
  CoreServices,
  PluginDefaultPageContractMaterializationMode,
  PluginDefaultPageContractResolutionStatus,
  PluginState,
} from '@fromcode119/core';
import { ResolutionService } from '@api/services/resolution-service';

describe('ResolutionService default page contract routing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    CoreServices.reset();
  });

  it('resolves singleton aliases through the contract canonical page slug', async () => {
    const restController = {
      find: vi.fn().mockImplementation((_collection: any, options: any) => {
        if (options?.query?.slug === 'numerology') {
          return Promise.resolve({ docs: [] });
        }

        if (options?.query?.slug === 'shop') {
          return Promise.resolve({ docs: [{ id: 1, slug: 'shop' }] });
        }

        return Promise.resolve({ docs: [] });
      }),
    };
    const manager: any = {
      db: { find: vi.fn().mockResolvedValue([]) },
      getPlugins: vi.fn().mockReturnValue([{ state: PluginState.ACTIVE, manifest: { slug: 'ecommerce' } }]),
      registeredCollections: new Map([
        [
          'pages',
          {
            pluginSlug: 'system',
            collection: {
              slug: 'pages',
              shortSlug: 'pages',
              fields: [{ name: 'slug' }],
            },
          },
        ],
      ]),
    };
    const themeManager: any = {
      getActiveThemeDefaultPageContractOverrides: vi.fn().mockResolvedValue([]),
    };

    vi.spyOn(CoreServices, 'getInstance').mockReturnValue({
      contentResolutionGates: { apply: vi.fn(async (resolved: any) => resolved) },
      redirectResolvers: { resolve: vi.fn(async () => null) },
      defaultPageContractResolution: {
        resolveAll: vi.fn().mockReturnValue([
          {
            install: true,
            status: PluginDefaultPageContractResolutionStatus.READY,
            materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
            effectiveSlug: '/shop',
            effectiveAliases: ['/numerology'],
          },
        ]),
      },
    } as any);

    const service = new ResolutionService(manager, themeManager, restController as any);
    const result = await service.resolveSlug('/numerology', {});

    expect(result).toEqual({
      type: 'pages',
      plugin: 'system',
      doc: { id: 1, slug: 'shop' },
    });
    expect(restController.find).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'pages' }),
      expect.objectContaining({
        query: expect.objectContaining({ slug: 'shop', limit: 1, preview: '0' }),
      }),
    );
  });

  it('skips disabled singleton contracts during contract-aware resolution', async () => {
    const restController = {
      find: vi.fn(),
    };
    const manager: any = {
      db: { find: vi.fn().mockResolvedValue([]) },
      getPlugins: vi.fn().mockReturnValue([{ state: PluginState.ACTIVE, manifest: { slug: 'privacy' } }]),
      registeredCollections: new Map([
        [
          'pages',
          {
            pluginSlug: 'system',
            collection: {
              slug: 'pages',
              shortSlug: 'pages',
              fields: [],
            },
          },
        ],
      ]),
    };
    const themeManager: any = {
      getActiveThemeDefaultPageContractOverrides: vi.fn().mockResolvedValue([]),
    };

    vi.spyOn(CoreServices, 'getInstance').mockReturnValue({
      contentResolutionGates: { apply: vi.fn(async (resolved: any) => resolved) },
      redirectResolvers: { resolve: vi.fn(async () => null) },
      defaultPageContractResolution: {
        resolveAll: vi.fn().mockReturnValue([
          {
            install: false,
            status: PluginDefaultPageContractResolutionStatus.SKIPPED,
            materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
            effectiveSlug: '/privacy-policy',
            effectiveAliases: [],
          },
        ]),
      },
    } as any);

    const service = new ResolutionService(manager, themeManager, restController as any);

    await expect(service.resolveSlug('/privacy-policy', {})).resolves.toBeNull();
    expect(restController.find).not.toHaveBeenCalled();
  });

  it('resolves parameterized detail families through the contract record collection', async () => {
    const restController = {
      find: vi.fn().mockImplementation((collection: any, options: any) => {
        if (collection.slug === 'ecommerce-products') {
          return Promise.resolve({ docs: [{ id: 7, slug: 'lyubov', name: 'Love Box' }] });
        }

        return Promise.resolve({ docs: [] });
      }),
    };
    const manager: any = {
      db: { find: vi.fn().mockResolvedValue([]) },
      getPlugins: vi.fn().mockReturnValue([{ state: PluginState.ACTIVE, manifest: { slug: 'ecommerce' } }]),
      registeredCollections: new Map([
        [
          'catalog',
          {
            pluginSlug: 'ecommerce',
            collection: {
              slug: 'ecommerce-products',
              shortSlug: 'catalog',
              fields: [{ name: 'slug' }],
            },
          },
        ],
      ]),
    };
    const themeManager: any = {
      getActiveThemeDefaultPageContractOverrides: vi.fn().mockResolvedValue([]),
    };

    vi.spyOn(CoreServices, 'getInstance').mockReturnValue({
      contentResolutionGates: { apply: vi.fn(async (resolved: any) => resolved) },
      redirectResolvers: { resolve: vi.fn(async () => null) },
      defaultPageContractResolution: {
        resolveAll: vi.fn().mockReturnValue([
          {
            install: true,
            status: PluginDefaultPageContractResolutionStatus.READY,
            materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
            effectiveSlug: '/shop/:slug',
            effectiveAliases: ['/cosmic-box/:slug'],
            recordCollection: 'catalog',
            pluginSlug: 'ecommerce',
          },
        ]),
      },
    } as any);

    const service = new ResolutionService(manager, themeManager, restController as any);
    const result = await service.resolveSlug('/shop/lyubov', {});

    expect(result).toEqual({
      type: 'catalog',
      plugin: 'ecommerce',
      doc: { id: 7, slug: 'lyubov', name: 'Love Box' },
    });
  });

  it('prefers exact permalink pages before contract detail fallback', async () => {
    const restController = {
      find: vi.fn().mockImplementation((collection: any, options: any) => {
        if (collection.slug === 'pages') {
          if (options?.query?.customPermalink === '/cosmic-box/lyubov') {
            return Promise.resolve({ docs: [{ id: 18, slug: 'cosmic-box/lyubov', customPermalink: '/cosmic-box/lyubov' }] });
          }
        }

        if (collection.slug === 'ecommerce-products') {
          return Promise.resolve({ docs: [{ id: 7, slug: 'lyubov', name: 'Love Box' }] });
        }

        return Promise.resolve({ docs: [] });
      }),
    };
    const manager: any = {
      db: { find: vi.fn().mockResolvedValue([]) },
      getPlugins: vi.fn().mockReturnValue([{ state: PluginState.ACTIVE, manifest: { slug: 'ecommerce' } }]),
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
        [
          'catalog',
          {
            pluginSlug: 'ecommerce',
            collection: {
              slug: 'ecommerce-products',
              shortSlug: 'catalog',
              fields: [{ name: 'slug' }, { name: 'page' }],
            },
          },
        ],
      ]),
    };
    const themeManager: any = {
      getActiveThemeDefaultPageContractOverrides: vi.fn().mockResolvedValue([]),
    };

    vi.spyOn(CoreServices, 'getInstance').mockReturnValue({
      contentResolutionGates: { apply: vi.fn(async (resolved: any) => resolved) },
      redirectResolvers: { resolve: vi.fn(async () => null) },
      defaultPageContractResolution: {
        resolveAll: vi.fn().mockReturnValue([
          {
            install: true,
            status: PluginDefaultPageContractResolutionStatus.READY,
            materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
            effectiveSlug: '/shop/:slug',
            effectiveAliases: ['/cosmic-box/:slug'],
            recordCollection: 'catalog',
            pluginSlug: 'ecommerce',
          },
        ]),
      },
    } as any);

    const service = new ResolutionService(manager, themeManager, restController as any);
    const result = await service.resolveSlug('/cosmic-box/lyubov', {});

    expect(result).toEqual({
      type: 'pages',
      plugin: 'system',
      doc: { id: 18, slug: 'cosmic-box/lyubov', customPermalink: '/cosmic-box/lyubov' },
    });
  });

  it('returns the CMS page for /shop when an exact page permalink exists and preserves safe contract presentation', async () => {
    const restController = {
      find: vi.fn().mockImplementation((collection: any, options: any) => {
        if (collection.slug === 'pages' && options?.query?.customPermalink === '/shop') {
          return Promise.resolve({ docs: [{ id: 9, slug: 'shop', customPermalink: '/shop' }] });
        }

        if (collection.slug === 'synthetic-catalog') {
          return Promise.resolve({ docs: [{ id: 77, slug: 'shop', title: 'Synthetic Catalog' }] });
        }

        return Promise.resolve({ docs: [] });
      }),
    };
    const manager: any = {
      db: { find: vi.fn().mockResolvedValue([]) },
      getPlugins: vi.fn().mockReturnValue([{ state: PluginState.ACTIVE, manifest: { slug: 'catalog-module' } }]),
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
        [
          'catalog',
          {
            pluginSlug: 'catalog-module',
            collection: {
              slug: 'synthetic-catalog',
              shortSlug: 'catalog',
              fields: [{ name: 'slug' }],
            },
          },
        ],
      ]),
    };
    const themeManager: any = {
      getActiveThemeDefaultPageContractOverrides: vi.fn().mockResolvedValue([]),
    };

    vi.spyOn(CoreServices, 'getInstance').mockReturnValue({
      contentResolutionGates: { apply: vi.fn(async (resolved: any) => resolved) },
      redirectResolvers: { resolve: vi.fn(async () => null) },
      defaultPageContractResolution: {
        resolveAll: vi.fn().mockReturnValue([
          {
            install: true,
            status: PluginDefaultPageContractResolutionStatus.READY,
            materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
            effectiveSlug: '/shop',
            effectiveAliases: [],
            effectiveTitle: 'Catalog Contract Page',
            effectiveThemeLayout: 'CatalogLayout',
            recordCollection: 'catalog',
            pluginSlug: 'catalog-module',
          },
        ]),
      },
    } as any);

    const service = new ResolutionService(manager, themeManager, restController as any);
    const result = await service.resolveSlug('/shop', {});

    expect(result).toEqual({
      type: 'pages',
      plugin: 'system',
      doc: {
        id: 9,
        slug: 'shop',
        customPermalink: '/shop',
        title: 'Catalog Contract Page',
        themeLayout: 'CatalogLayout',
      },
    });
  });

  it('falls back to the enabled contract for /shop when no exact CMS page exists', async () => {
    const restController = {
      find: vi.fn().mockImplementation((collection: any, options: any) => {
        if (collection.slug === 'pages' && options?.query?.customPermalink === '/shop') {
          return Promise.resolve({ docs: [] });
        }

        if (collection.slug === 'pages' && options?.query?.slug === 'shop') {
          return Promise.resolve({ docs: [{ id: 42, slug: 'shop', title: 'Contract Catalog Page' }] });
        }

        return Promise.resolve({ docs: [] });
      }),
    };
    const manager: any = {
      db: { find: vi.fn().mockResolvedValue([]) },
      getPlugins: vi.fn().mockReturnValue([{ state: PluginState.ACTIVE, manifest: { slug: 'catalog-module' } }]),
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
    const themeManager: any = {
      getActiveThemeDefaultPageContractOverrides: vi.fn().mockResolvedValue([]),
    };

    vi.spyOn(CoreServices, 'getInstance').mockReturnValue({
      contentResolutionGates: { apply: vi.fn(async (resolved: any) => resolved) },
      redirectResolvers: { resolve: vi.fn(async () => null) },
      defaultPageContractResolution: {
        resolveAll: vi.fn().mockReturnValue([
          {
            install: true,
            status: PluginDefaultPageContractResolutionStatus.READY,
            materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
            effectiveSlug: '/shop',
            effectiveAliases: [],
            pluginSlug: 'catalog-module',
          },
        ]),
      },
    } as any);

    const service = new ResolutionService(manager, themeManager, restController as any);
    const result = await service.resolveSlug('/shop', {});

    expect(result).toEqual({
      type: 'pages',
      plugin: 'system',
      doc: { id: 42, slug: 'shop', title: 'Contract Catalog Page' },
    });
    expect(restController.find).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'pages' }),
      expect.objectContaining({
        query: expect.objectContaining({ slug: 'shop', limit: 1, preview: '0' }),
      }),
    );
  });

  it('does not fall back for /shop when the matching contract is disabled', async () => {
    const restController = {
      find: vi.fn().mockImplementation((collection: any, options: any) => {
        if (collection.slug === 'pages' && options?.query?.customPermalink === '/shop') {
          return Promise.resolve({ docs: [] });
        }

        return Promise.resolve({ docs: [] });
      }),
    };
    const manager: any = {
      db: { find: vi.fn().mockResolvedValue([]) },
      getPlugins: vi.fn().mockReturnValue([{ state: PluginState.ACTIVE, manifest: { slug: 'catalog-module' } }]),
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
    const themeManager: any = {
      getActiveThemeDefaultPageContractOverrides: vi.fn().mockResolvedValue([]),
    };

    vi.spyOn(CoreServices, 'getInstance').mockReturnValue({
      contentResolutionGates: { apply: vi.fn(async (resolved: any) => resolved) },
      redirectResolvers: { resolve: vi.fn(async () => null) },
      defaultPageContractResolution: {
        resolveAll: vi.fn().mockReturnValue([
          {
            install: false,
            status: PluginDefaultPageContractResolutionStatus.SKIPPED,
            materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
            effectiveSlug: '/shop',
            effectiveAliases: [],
            pluginSlug: 'catalog-module',
          },
        ]),
      },
    } as any);

    const service = new ResolutionService(manager, themeManager, restController as any);

    await expect(service.resolveSlug('/shop', {})).resolves.toBeNull();
  });

  it('does not resolve detail contracts for records with disabled permalinks', async () => {
    const restController = {
      find: vi.fn().mockImplementation((collection: any) => {
        if (collection.slug === 'ecommerce-products') {
          return Promise.resolve({ docs: [{ id: 7, slug: 'lyubov', disablePermalink: '1.0' }] });
        }

        return Promise.resolve({ docs: [] });
      }),
    };
    const manager: any = {
      db: {
        find: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue({ id: 7, disablePermalink: '1.0' }),
      },
      getPlugins: vi.fn().mockReturnValue([{ state: PluginState.ACTIVE, manifest: { slug: 'ecommerce' } }]),
      registeredCollections: new Map([
        [
          'catalog',
          {
            pluginSlug: 'ecommerce',
            collection: {
              slug: 'ecommerce-products',
              shortSlug: 'catalog',
              fields: [{ name: 'slug' }],
            },
          },
        ],
      ]),
    };
    const themeManager: any = {
      getActiveThemeDefaultPageContractOverrides: vi.fn().mockResolvedValue([]),
    };

    vi.spyOn(CoreServices, 'getInstance').mockReturnValue({
      contentResolutionGates: { apply: vi.fn(async (resolved: any) => resolved) },
      redirectResolvers: { resolve: vi.fn(async () => null) },
      defaultPageContractResolution: {
        resolveAll: vi.fn().mockReturnValue([
          {
            install: true,
            status: PluginDefaultPageContractResolutionStatus.READY,
            materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
            effectiveSlug: '/shop/:slug',
            effectiveAliases: [],
            recordCollection: 'catalog',
            pluginSlug: 'ecommerce',
          },
        ]),
      },
    } as any);

    const service = new ResolutionService(manager, themeManager, restController as any);
    const result = await service.resolveSlug('/shop/lyubov', {});

    expect(result).toBeNull();
  });

  it('does not let path-only analytics records hijack public URLs', async () => {
    const restController = {
      find: vi.fn().mockImplementation((collection: any, options: any) => {
        if (collection.slug === 'pages' && options?.query?.slug === 'courses/21-dni-kurs-za-finansovo-izobilie') {
          return Promise.resolve({ docs: [] });
        }

        if (collection.slug === 'lms-courses' && options?.query?.slug === '21-dni-kurs-za-finansovo-izobilie') {
          return Promise.resolve({ docs: [{ id: 21, slug: '21-dni-kurs-za-finansovo-izobilie', title: '21-дневен курс' }] });
        }

        return Promise.resolve({ docs: [] });
      }),
    };
    const manager: any = {
      db: { find: vi.fn().mockResolvedValue([]) },
      getPlugins: vi.fn().mockReturnValue([
        { state: PluginState.ACTIVE, manifest: { slug: 'analytics' } },
        { state: PluginState.ACTIVE, manifest: { slug: 'lms' } },
      ]),
      registeredCollections: new Map([
        [
          'analytics-events',
          {
            pluginSlug: 'analytics',
            collection: {
              slug: 'analytics-events',
              shortSlug: 'site-events',
              fields: [{ name: 'path' }],
            },
          },
        ],
        [
          'courses',
          {
            pluginSlug: 'lms',
            collection: {
              slug: 'lms-courses',
              shortSlug: 'courses',
              fields: [{ name: 'slug' }],
            },
          },
        ],
      ]),
    };
    const themeManager: any = {
      getActiveThemeDefaultPageContractOverrides: vi.fn().mockResolvedValue([]),
    };

    vi.spyOn(CoreServices, 'getInstance').mockReturnValue({
      contentResolutionGates: { apply: vi.fn(async (resolved: any) => resolved) },
      redirectResolvers: { resolve: vi.fn(async () => null) },
      defaultPageContractResolution: {
        resolveAll: vi.fn().mockReturnValue([
          {
            install: true,
            status: PluginDefaultPageContractResolutionStatus.READY,
            materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
            effectiveSlug: '/courses/:slug',
            effectiveAliases: [],
            recordCollection: 'courses',
            pluginSlug: 'lms',
          },
        ]),
      },
    } as any);

    const service = new ResolutionService(manager, themeManager, restController as any);
    const result = await service.resolveSlug('/courses/21-dni-kurs-za-finansovo-izobilie', {});

    expect(result).toEqual({
      type: 'courses',
      plugin: 'lms',
      doc: { id: 21, slug: '21-dni-kurs-za-finansovo-izobilie', title: '21-дневен курс' },
    });
    expect(restController.find).not.toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'analytics-events' }),
      expect.objectContaining({ query: expect.objectContaining({ path: '/courses/21-dni-kurs-za-finansovo-izobilie' }) }),
    );
  });
});