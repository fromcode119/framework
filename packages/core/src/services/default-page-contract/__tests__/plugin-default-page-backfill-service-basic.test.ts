import { beforeEach, describe, expect, it } from 'vitest';
import type {
  PluginDefaultPageContractBackfillAssociationSnapshot,
  PluginDefaultPageContractBackfillPageSnapshot,
  ResolvedPluginDefaultPageContract,
} from '../../../types';
import { PluginDefaultPageBackfillService } from '../plugin-default-page-backfill-service';
import { SeedPageService } from '../../seed-page-service';

describe('PluginDefaultPageBackfillService basic planning', () => {
  let service: PluginDefaultPageBackfillService;

  beforeEach(() => {
    service = new PluginDefaultPageBackfillService(new SeedPageService());
  });

  it('returns entries in deterministic canonical key order', () => {
    const plan = service.createPlan({
      resolvedContracts: [
        createResolvedContract({
          canonicalKey: 'org.fromcode:privacy:privacy-policy-page',
          pluginSlug: 'privacy',
          key: 'privacy-policy-page',
          effectiveSlug: '/privacy-policy',
        }),
        createResolvedContract(),
      ],
      existingPages: [],
      existingAssociations: {},
    });

    expect(plan.entries.map((entry) => entry.canonicalKey)).toEqual([
      'org.fromcode:ecommerce:store-index',
      'org.fromcode:privacy:privacy-policy-page',
    ]);
    expect(plan.summary.total).toBe(2);
  });

  it('marks a contract already-associated when its association points to a page in the snapshot', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [{ id: 42, customPermalink: '/shop' }],
      existingAssociations: {
        byCanonicalKey: {
          'org.fromcode:ecommerce:store-index': {
            canonicalKey: 'org.fromcode:ecommerce:store-index',
            pageId: 42,
          },
        },
      },
    }).entries;

    expect(entry.action).toBe('already-associated');
    expect(entry.status).toBe('already-associated');
    expect(entry.matchedPageId).toBeUndefined();
    expect(entry.existingAssociationPageId).toBe(42);
  });

  it('associates a single eligible existing page when there is no conflicting association', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [{ id: 7, customPermalink: '/shop/' }],
      existingAssociations: {},
    }).entries;

    expect(entry.action).toBe('associate-existing');
    expect(entry.status).toBe('safe-to-associate');
    expect(entry.matchedPageId).toBe(7);
    expect(entry.reasons).toEqual(['matched-by-customPermalink']);
  });

  it('propagates skipped and blocked resolved contracts without proposing associations', () => {
    const plan = service.createPlan({
      resolvedContracts: [
        createResolvedContract({
          canonicalKey: 'org.fromcode:forms:contact-page',
          pluginSlug: 'forms',
          key: 'contact-page',
          kind: 'form-page',
          effectiveSlug: '/contact',
          effectiveAliases: [],
          status: 'skipped',
          reasons: ['install-disabled'],
        }),
        createResolvedContract({
          canonicalKey: 'org.fromcode:privacy:cookies-policy-page',
          pluginSlug: 'privacy',
          key: 'cookies-policy-page',
          kind: 'policy',
          effectiveSlug: '/cookies-policy',
          effectiveAliases: [],
          status: 'blocked',
          reasons: ['compliance-disabled'],
        }),
      ],
      existingPages: [{ id: 99, customPermalink: '/contact' }],
      existingAssociations: {},
    });

    expect(plan.entries).toEqual([
      expect.objectContaining({ action: 'skipped', status: 'skipped', reasons: ['install-disabled'] }),
      expect.objectContaining({ action: 'blocked', status: 'blocked', reasons: ['compliance-disabled'] }),
    ]);
  });

  it('defers per-record-document contracts', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [
        createResolvedContract({
          canonicalKey: 'org.fromcode:lms:course-detail',
          pluginSlug: 'lms',
          key: 'course-detail',
          kind: 'detail',
          effectiveSlug: '/courses',
          effectiveAliases: [],
          materializationMode: 'per-record-document',
        }),
      ],
      existingPages: [{ id: 3, customPermalink: '/courses' }],
      existingAssociations: {},
    }).entries;

    expect(entry.action).toBe('deferred');
    expect(entry.status).toBe('deferred');
    expect(entry.matchedPageId).toBeUndefined();
  });

  it('does not mutate resolved contracts, existing pages, or association snapshots', () => {
    const resolvedContracts = [createResolvedContract()];
    const existingPages: PluginDefaultPageContractBackfillPageSnapshot[] = [
      { id: 5, slug: 'shop', customPermalink: '/shop' },
    ];
    const existingAssociations: PluginDefaultPageContractBackfillAssociationSnapshot = {
      byCanonicalKey: {
        'org.fromcode:ecommerce:store-index': {
          pageId: 5,
        },
      },
    };
    const plan = service.createPlan({ resolvedContracts, existingPages, existingAssociations });

    plan.entries[0].lookupCandidates.push('/mutated');
    plan.entries[0].reasons.push('mutated');

    expect(resolvedContracts).toEqual([createResolvedContract()]);
    expect(existingPages).toEqual([{ id: 5, slug: 'shop', customPermalink: '/shop' }]);
    expect(existingAssociations).toEqual({
      byCanonicalKey: {
        'org.fromcode:ecommerce:store-index': {
          pageId: 5,
        },
      },
    });
  });

  it('produces stable summary counts for actions and statuses', () => {
    const plan = service.createPlan({
      resolvedContracts: [
        createResolvedContract({ canonicalKey: 'org.fromcode:ecommerce:store-a', key: 'store-a', effectiveSlug: '/a', adoptionHints: ['/a'] }),
        createResolvedContract({ canonicalKey: 'org.fromcode:ecommerce:store-b', key: 'store-b', effectiveSlug: '/b', adoptionHints: ['/b'], status: 'skipped', reasons: ['install-disabled'] }),
        createResolvedContract({ canonicalKey: 'org.fromcode:ecommerce:store-c', key: 'store-c', effectiveSlug: '/c', adoptionHints: ['/c'], materializationMode: 'adopt-only' }),
        createResolvedContract({ canonicalKey: 'org.fromcode:ecommerce:store-d', key: 'store-d', effectiveSlug: '/d', adoptionHints: ['/d'] }),
      ],
      existingPages: [
        { id: 1, customPermalink: '/d' },
        { id: 11, customPermalink: '/legacy-a' },
      ],
      existingAssociations: {
        byCanonicalKey: {
          'org.fromcode:ecommerce:store-a': {
            pageId: 11,
          },
        },
      },
    });

    expect(plan.summary).toEqual({
      total: 4,
      byAction: {
        'already-associated': 1,
        ambiguous: 0,
        'associate-existing': 1,
        blocked: 1,
        deferred: 0,
        skipped: 1,
      },
      byStatus: {
        'already-associated': 1,
        ambiguous: 0,
        blocked: 1,
        deferred: 0,
        'safe-to-associate': 1,
        skipped: 1,
      },
    });
  });
});

function createResolvedContract(overrides: Partial<ResolvedPluginDefaultPageContract> = {}): ResolvedPluginDefaultPageContract {
  return {
    key: 'store-index',
    kind: 'index',
    defaultSlug: '/shop',
    capability: 'catalog',
    recipe: 'ecommerce.store-index',
    materializationMode: 'singleton-document',
    dependencies: ['search'],
    adoptionHints: ['/shop'],
    aliases: ['/catalog'],
    required: true,
    namespace: 'org.fromcode',
    pluginSlug: 'ecommerce',
    canonicalKey: 'org.fromcode:ecommerce:store-index',
    effectiveAliases: ['/catalog'],
    effectiveRecipe: 'ecommerce.store-index',
    effectiveSlug: '/shop',
    effectiveThemeLayout: 'StoreLayout',
    effectiveTitle: 'Store',
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