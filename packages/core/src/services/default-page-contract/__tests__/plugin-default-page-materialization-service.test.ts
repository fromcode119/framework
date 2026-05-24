import { beforeEach, describe, expect, it } from 'vitest';
import type {
  PluginDefaultPageContractMaterializationPlanInput,
  PluginDefaultPageContractPageSnapshot,
  ResolvedPluginDefaultPageContract,
} from '../../../types';
import { PluginDefaultPageMaterializationService } from '../plugin-default-page-materialization-service';
import { SeedPageService } from '../../seed-page-service';

const TEST_NAMESPACE = 'org.synthetic';
const CATALOG_CANONICAL_KEY = 'org.synthetic:catalog-module:catalog-index';
const POLICY_CANONICAL_KEY = 'org.synthetic:policy-module:primary-policy-page';

describe('PluginDefaultPageMaterializationService', () => {
  let service: PluginDefaultPageMaterializationService;

  beforeEach(() => {
    service = new PluginDefaultPageMaterializationService(new SeedPageService());
  });

  it('returns entries in deterministic canonical key order', () => {
    const plan = service.createPlan({
      resolvedContracts: [
        createResolvedContract({
          canonicalKey: POLICY_CANONICAL_KEY,
          pluginSlug: 'policy-module',
          key: 'primary-policy-page',
          effectiveSlug: '/primary-policy',
        }),
        createResolvedContract(),
      ],
      existingPages: [],
    });

    expect(plan.entries.map((entry) => entry.canonicalKey)).toEqual([
      CATALOG_CANONICAL_KEY,
      POLICY_CANONICAL_KEY,
    ]);
    expect(plan.summary.total).toBe(2);
  });

  it('adopts an existing page on a unique custom permalink match', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [
        {
          id: 42,
          slug: 'catalog-home',
          customPermalink: '/catalog',
        },
      ],
    }).entries;

    expect(entry.action).toBe('adopt-existing');
    expect(entry.status).toBe('ready');
    expect(entry.matchedPageId).toBe(42);
    expect(entry.createPayload).toBeUndefined();
  });

  it('prefers custom permalink matches over slug-only matches', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [
        {
          id: 10,
          slug: 'catalog',
        },
        {
          id: 20,
          slug: 'different-slug',
          customPermalink: '/catalog',
        },
      ],
    }).entries;

    expect(entry.action).toBe('adopt-existing');
    expect(entry.matchedPageId).toBe(20);
  });

  it('treats trailing-slash permalink variants as equivalent during adoption matching', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [
        {
          id: 77,
          customPermalink: '/catalog/',
        },
      ],
    }).entries;

    expect(entry.action).toBe('adopt-existing');
    expect(entry.status).toBe('ready');
    expect(entry.matchedPageId).toBe(77);
  });

  it('creates missing payloads for ready singleton contracts with no match', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [],
    }).entries;

    expect(entry.action).toBe('create-missing');
    expect(entry.status).toBe('ready');
    expect(entry.createPayload).toEqual({
      canonicalKey: CATALOG_CANONICAL_KEY,
      namespace: TEST_NAMESPACE,
      pluginSlug: 'catalog-module',
      key: 'catalog-index',
      slug: 'catalog',
      customPermalink: '/catalog',
      aliases: ['/browse'],
      recipe: 'catalog-module.catalog-index',
      title: 'Catalog',
      themeLayout: 'CatalogLayout',
    });
  });

  it('marks a contract ambiguous when multiple pages match the same best-priority candidates', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [
        { id: 1, customPermalink: '/catalog' },
        { id: 2, customPermalink: '/browse' },
      ],
    }).entries;

    expect(entry.action).toBe('ambiguous');
    expect(entry.status).toBe('ambiguous');
    expect(entry.matchedPageId).toBeUndefined();
  });

  it('fails closed when multiple contracts claim the same existing page', () => {
    const plan = service.createPlan({
      resolvedContracts: [
        createResolvedContract(),
        createResolvedContract({
          canonicalKey: 'org.synthetic:contact-module:contact-page',
          pluginSlug: 'contact-module',
          key: 'contact-page',
          kind: 'form-page',
          capability: 'contact-form',
          recipe: 'contact-module.contact-page',
          effectiveRecipe: 'contact-module.contact-page',
          effectiveSlug: '/catalog',
          effectiveTitle: 'Contact',
          effectiveThemeLayout: 'DefaultLayout',
          aliases: [],
          effectiveAliases: [],
          adoptionHints: ['/catalog'],
        }),
      ],
      existingPages: [
        {
          id: 42,
          customPermalink: '/catalog',
        },
      ],
    });

    expect(plan.entries).toEqual([
      expect.objectContaining({
        canonicalKey: CATALOG_CANONICAL_KEY,
        action: 'ambiguous',
        status: 'ambiguous',
        matchedPageId: undefined,
        reasons: ['matched-by-customPermalink', 'matched-page-claimed-by-multiple-contracts'],
      }),
      expect.objectContaining({
        canonicalKey: 'org.synthetic:contact-module:contact-page',
        action: 'ambiguous',
        status: 'ambiguous',
        matchedPageId: undefined,
        reasons: ['matched-by-customPermalink', 'matched-page-claimed-by-multiple-contracts'],
      }),
    ]);
    expect(plan.summary.byAction.ambiguous).toBe(2);
    expect(plan.summary.byStatus.ambiguous).toBe(2);
    expect(plan.summary.byAction['adopt-existing']).toBe(0);
  });

  it('propagates skipped and blocked resolved statuses without planning writes', () => {
    const plan = service.createPlan({
      resolvedContracts: [
        createResolvedContract({
          canonicalKey: 'org.synthetic:contact-module:contact-page',
          pluginSlug: 'contact-module',
          key: 'contact-page',
          kind: 'form-page',
          effectiveSlug: '/contact',
          effectiveAliases: [],
          status: 'skipped',
          reasons: ['install-disabled'],
        }),
        createResolvedContract({
          canonicalKey: 'org.synthetic:policy-module:secondary-policy-page',
          pluginSlug: 'policy-module',
          key: 'secondary-policy-page',
          kind: 'policy',
          effectiveSlug: '/secondary-policy',
          effectiveAliases: [],
          status: 'blocked',
          reasons: ['compliance-disabled'],
        }),
      ],
      existingPages: [{ id: 99, customPermalink: '/contact' }],
    });

    expect(plan.entries).toEqual([
      expect.objectContaining({ action: 'skip', status: 'skipped', reasons: ['install-disabled'] }),
      expect.objectContaining({ action: 'blocked', status: 'blocked', reasons: ['compliance-disabled'] }),
    ]);
  });

  it('defers per-record-document contracts', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [
        createResolvedContract({
          canonicalKey: 'org.synthetic:learning-module:course-detail',
          pluginSlug: 'learning-module',
          key: 'course-detail',
          kind: 'detail',
          effectiveSlug: '/courses',
          effectiveAliases: [],
          materializationMode: 'per-record-document',
        }),
      ],
      existingPages: [{ id: 3, customPermalink: '/courses' }],
    }).entries;

    expect(entry.action).toBe('deferred');
    expect(entry.status).toBe('deferred');
    expect(entry.createPayload).toBeUndefined();
  });

  it('defers parameterized singleton routes instead of planning literal placeholder pages', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [
        createResolvedContract({
          canonicalKey: 'org.synthetic:catalog-module:catalog-detail',
          pluginSlug: 'catalog-module',
          key: 'catalog-detail',
          kind: 'detail',
          effectiveSlug: '/catalog/:slug',
          effectiveAliases: ['/browse/:slug'],
          adoptionHints: ['/catalog/:slug'],
          recordCollection: 'catalog',
        }),
      ],
      existingPages: [{ id: 44, customPermalink: '/catalog/:slug' }],
    }).entries;

    expect(entry.action).toBe('deferred');
    expect(entry.status).toBe('deferred');
    expect(entry.matchedPageId).toBeUndefined();
    expect(entry.createPayload).toBeUndefined();
    expect(entry.reasons).toEqual(['parameterized-route-deferred']);
  });

  it('never creates payloads for adopt-only contracts', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [
        createResolvedContract({
          materializationMode: 'adopt-only',
        }),
      ],
      existingPages: [],
    }).entries;

    expect(entry.action).toBe('blocked');
    expect(entry.status).toBe('blocked');
    expect(entry.createPayload).toBeUndefined();
    expect(entry.reasons).toEqual(['adopt-only-no-match']);
  });

  it('does not mutate resolved contract inputs or page snapshots', () => {
    const resolvedContracts = [createResolvedContract()];
    const existingPages: PluginDefaultPageContractPageSnapshot[] = [
      {
        id: 5,
        slug: 'catalog',
        customPermalink: '/catalog',
      },
    ];
    const plan = service.createPlan({ resolvedContracts, existingPages });

    plan.entries[0].lookupCandidates.push('/mutated');
    plan.entries[0].reasons.push('mutated');
    plan.entries[0].createPayload?.aliases.push('/mutated');

    expect(resolvedContracts).toEqual([createResolvedContract()]);
    expect(existingPages).toEqual([
      {
        id: 5,
        slug: 'catalog',
        customPermalink: '/catalog',
      },
    ]);
  });

  it('produces stable summary counts for actions and statuses', () => {
    const plan = service.createPlan({
      resolvedContracts: [
        createResolvedContract({ canonicalKey: 'org.synthetic:catalog-module:page-a', key: 'page-a', effectiveSlug: '/a' }),
        createResolvedContract({ canonicalKey: 'org.synthetic:catalog-module:page-b', key: 'page-b', effectiveSlug: '/b', status: 'skipped', reasons: ['install-disabled'] }),
        createResolvedContract({ canonicalKey: 'org.synthetic:catalog-module:page-c', key: 'page-c', effectiveSlug: '/c', materializationMode: 'adopt-only' }),
      ],
      existingPages: [{ id: 1, customPermalink: '/a' }],
    });

    expect(plan.summary).toEqual({
      total: 3,
      byAction: {
        'adopt-existing': 1,
        ambiguous: 0,
        blocked: 1,
        'create-missing': 0,
        deferred: 0,
        skip: 1,
      },
      byStatus: {
        ambiguous: 0,
        blocked: 1,
        deferred: 0,
        ready: 1,
        skipped: 1,
      },
    });
  });
});

function createResolvedContract(overrides: Partial<ResolvedPluginDefaultPageContract> = {}): ResolvedPluginDefaultPageContract {
  return {
    key: 'catalog-index',
    kind: 'index',
    defaultSlug: '/catalog',
    capability: 'catalog',
    recipe: 'catalog-module.catalog-index',
    materializationMode: 'singleton-document',
    dependencies: ['search'],
    adoptionHints: ['/catalog'],
    aliases: ['/browse'],
    required: true,
    namespace: TEST_NAMESPACE,
    pluginSlug: 'catalog-module',
    canonicalKey: CATALOG_CANONICAL_KEY,
    effectiveAliases: ['/browse'],
    effectiveRecipe: 'catalog-module.catalog-index',
    effectiveSlug: '/catalog',
    effectiveThemeLayout: 'CatalogLayout',
    effectiveTitle: 'Catalog',
    install: true,
    prerequisiteReady: true,
    provenance: {
      overrideApplied: false,
      siteStateMatch: 'none',
    },
    reasons: [],
    sources: {
      effectiveAliases: 'declaration',
      effectiveRecipe: 'declaration',
      effectiveSlug: 'declaration',
      effectiveThemeLayout: 'declaration',
      effectiveTitle: 'declaration',
      install: 'declaration',
      prerequisiteReady: 'declaration',
      status: 'declaration',
    },
    status: 'ready',
    ...overrides,
  };
}