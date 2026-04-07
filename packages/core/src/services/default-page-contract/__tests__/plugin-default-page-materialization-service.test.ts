import { beforeEach, describe, expect, it } from 'vitest';
import type {
  PluginDefaultPageContractMaterializationPlanInput,
  PluginDefaultPageContractPageSnapshot,
  ResolvedPluginDefaultPageContract,
} from '../../../types';
import { PluginDefaultPageMaterializationService } from '../plugin-default-page-materialization-service';
import { SeedPageService } from '../../seed-page-service';

describe('PluginDefaultPageMaterializationService', () => {
  let service: PluginDefaultPageMaterializationService;

  beforeEach(() => {
    service = new PluginDefaultPageMaterializationService(new SeedPageService());
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
    });

    expect(plan.entries.map((entry) => entry.canonicalKey)).toEqual([
      'org.fromcode:ecommerce:store-index',
      'org.fromcode:privacy:privacy-policy-page',
    ]);
    expect(plan.summary.total).toBe(2);
  });

  it('adopts an existing page on a unique custom permalink match', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [
        {
          id: 42,
          slug: 'storefront',
          customPermalink: '/shop',
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
          slug: 'shop',
        },
        {
          id: 20,
          slug: 'different-slug',
          customPermalink: '/shop',
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
          customPermalink: '/shop/',
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
      canonicalKey: 'org.fromcode:ecommerce:store-index',
      namespace: 'org.fromcode',
      pluginSlug: 'ecommerce',
      key: 'store-index',
      slug: '/shop',
      customPermalink: '/shop',
      aliases: ['/catalog'],
      recipe: 'ecommerce.store-index',
      title: 'Store',
      themeLayout: 'StoreLayout',
    });
  });

  it('marks a contract ambiguous when multiple pages match the same best-priority candidates', () => {
    const [entry] = service.createPlan({
      resolvedContracts: [createResolvedContract()],
      existingPages: [
        { id: 1, customPermalink: '/shop' },
        { id: 2, customPermalink: '/catalog' },
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
          canonicalKey: 'org.fromcode:forms:contact-page',
          pluginSlug: 'forms',
          key: 'contact-page',
          kind: 'form-page',
          capability: 'forms',
          recipe: 'forms.contact-page',
          effectiveRecipe: 'forms.contact-page',
          effectiveSlug: '/shop',
          effectiveTitle: 'Contact',
          effectiveThemeLayout: 'DefaultLayout',
          aliases: [],
          effectiveAliases: [],
          adoptionHints: ['/shop'],
        }),
      ],
      existingPages: [
        {
          id: 42,
          customPermalink: '/shop',
        },
      ],
    });

    expect(plan.entries).toEqual([
      expect.objectContaining({
        canonicalKey: 'org.fromcode:ecommerce:store-index',
        action: 'ambiguous',
        status: 'ambiguous',
        matchedPageId: undefined,
        reasons: ['matched-by-customPermalink', 'matched-page-claimed-by-multiple-contracts'],
      }),
      expect.objectContaining({
        canonicalKey: 'org.fromcode:forms:contact-page',
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
    }).entries;

    expect(entry.action).toBe('deferred');
    expect(entry.status).toBe('deferred');
    expect(entry.createPayload).toBeUndefined();
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
        slug: 'shop',
        customPermalink: '/shop',
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
        slug: 'shop',
        customPermalink: '/shop',
      },
    ]);
  });

  it('produces stable summary counts for actions and statuses', () => {
    const plan = service.createPlan({
      resolvedContracts: [
        createResolvedContract({ canonicalKey: 'org.fromcode:ecommerce:store-a', key: 'store-a', effectiveSlug: '/a' }),
        createResolvedContract({ canonicalKey: 'org.fromcode:ecommerce:store-b', key: 'store-b', effectiveSlug: '/b', status: 'skipped', reasons: ['install-disabled'] }),
        createResolvedContract({ canonicalKey: 'org.fromcode:ecommerce:store-c', key: 'store-c', effectiveSlug: '/c', materializationMode: 'adopt-only' }),
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